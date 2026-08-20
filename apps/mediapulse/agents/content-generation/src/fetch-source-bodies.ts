import {
  buildDeadUrlRecords,
  expandFetchProviderEntries,
  extractPublishedDate,
  HostErrorTracker,
  hostFromUrl,
  isFutureDated,
  performWebFetch,
  resolveDeadUrls,
  runQualityGate,
  type LookupDeadUrls,
  type QualityDropForDeadUrl,
  type WebFetchFailure,
  type WebFetchLogger,
  type WebSearchResult,
} from "@workspace/agent-ingestion";
import type {
  FetchEventStatus,
  PostContentGenerationFetchedContentBody,
  PostDataCollectionDeadUrlsRecordBody,
} from "@workspace/agent-data-api-contract";

import type { ResolvedContentGenerationConfig } from "./config-schema.js";
import { compareSourcesForRanking } from "./lib/rank-sources.js";

/**
 * Keeps an extracted publication date only when it is not in the future.
 *
 * - Important: a date drawn from body text is often not the publication date. On 2026-08-20 an
 *   article about Bank Indonesia's QRIS policy was stamped 2026-10-01, the date the policy takes
 *   effect, six weeks after the run. `published_at` drives recency ranking, section freshness, and
 *   event dedup's same-day path, so a future stamp outranks genuinely fresh sources indefinitely.
 *
 * Only the future check applies. Age is settled at collection, and re-applying it here would drop
 * older sources a section still tolerates.
 *
 * @param publishedAt - Date extracted from the fetched page, or `null` when none was found.
 * @param now - Reference time, injectable for testing.
 * @returns The date when usable, otherwise `undefined`.
 */
export const acceptablePublishedDate = (
  publishedAt: Date | null,
  now: Date = new Date(),
): Date | undefined => {
  if (publishedAt === null) {
    return undefined;
  }

  return isFutureDated(publishedAt, now) ? undefined : publishedAt;
};

export type RequestedFetchSource = {
  dataSourceId: string;
  url: string;
  title: string;
  sectionScore?: number | null;
  publisherAuthority?: number | null;
  reason?: string;
  /**
   * True when the description carries a figure, so the article body decides whether that figure
   * can be reported at all. Ranked ahead of section fit when the budget cannot cover everything.
   */
  citesFigure?: boolean;
};

export type FetchEventDraft = {
  dataSourceId: string;
  reason: string;
  provider: string | null;
  status: FetchEventStatus;
};

export type FetchedBody = {
  content: string;
  fetchProvider: string;
  publishedAt?: string;
};

export type FetchSourceBodiesCounters = {
  requested: number;
  droppedByCap: number;
  droppedByDeadUrlCache: number;
  attempted: number;
  fetchSucceeded: number;
  fetchFailed: number;
  gateDropped: number;
  persisted: number;
};

export type FetchSourceBodiesResult = {
  fetchedContentById: Map<string, FetchedBody>;
  droppedByGateIds: Set<string>;
  counters: FetchSourceBodiesCounters;
  fetchEvents: FetchEventDraft[];
};

export type FetchSourceBodiesDeps = {
  persistFetchedContent: (
    body: PostContentGenerationFetchedContentBody,
  ) => Promise<{ updatedCount: number }>;
  lookupDeadUrls?: LookupDeadUrls;
  recordDeadUrls?: (
    body: PostDataCollectionDeadUrlsRecordBody,
  ) => Promise<unknown>;
  performWebFetchFn?: typeof performWebFetch;
  runQualityGateFn?: typeof runQualityGate;
  logger?: WebFetchLogger;
};

const emptyCounters = (requested: number): FetchSourceBodiesCounters => ({
  requested,
  droppedByCap: 0,
  droppedByDeadUrlCache: 0,
  attempted: 0,
  fetchSucceeded: 0,
  fetchFailed: 0,
  gateDropped: 0,
  persisted: 0,
});

const applyFetchCap = (
  sources: readonly RequestedFetchSource[],
  cap: number,
): RequestedFetchSource[] => {
  if (sources.length <= cap) {
    return [...sources];
  }

  return sources
    .map((source, index) => ({ source, index }))
    .sort((a, b) => {
      const figureDiff =
        Number(b.source.citesFigure ?? false) -
        Number(a.source.citesFigure ?? false);
      if (figureDiff !== 0) {
        return figureDiff;
      }
      const scoreDiff = compareSourcesForRanking(a.source, b.source);
      if (scoreDiff !== 0) {
        return scoreDiff;
      }

      return a.index - b.index;
    })
    .slice(0, cap)
    .map((entry) => entry.source);
};

export async function fetchSourceBodies(
  requested: readonly RequestedFetchSource[],
  config: ResolvedContentGenerationConfig,
  context: { tickerId: string; logger?: WebFetchLogger },
  deps: FetchSourceBodiesDeps,
): Promise<FetchSourceBodiesResult> {
  const counters = emptyCounters(requested.length);
  const fetchedContentById = new Map<string, FetchedBody>();
  const droppedByGateIds = new Set<string>();
  const fetchEvents: FetchEventDraft[] = [];

  if (requested.length === 0) {
    return { fetchedContentById, droppedByGateIds, counters, fetchEvents };
  }

  const log = deps.logger ?? context.logger;
  const performFetch = deps.performWebFetchFn ?? performWebFetch;
  const gate = deps.runQualityGateFn ?? runQualityGate;

  const capped = applyFetchCap(requested, config.maxFetchesPerRun);
  counters.droppedByCap = requested.length - capped.length;

  const byUrl = new Map<string, RequestedFetchSource>();
  for (const source of capped) {
    if (!byUrl.has(source.url)) {
      byUrl.set(source.url, source);
    }
  }

  let candidates = [...byUrl.values()];

  const deadUrlCache = config.resilience.deadUrlCache;
  if (deadUrlCache.enabled && deps.lookupDeadUrls) {
    const deadUrls = await resolveDeadUrls(
      context.tickerId,
      candidates.map((source) => source.url),
      deps.lookupDeadUrls,
      deadUrlCache.skipLookupBatchSize,
    );
    if (deadUrls.size > 0) {
      const before = candidates.length;
      candidates = candidates.filter((source) => !deadUrls.has(source.url));
      counters.droppedByDeadUrlCache = before - candidates.length;
    }
  }

  const hostErrorTracker = new HostErrorTracker(
    config.resilience.hostErrorBreaker,
  );
  candidates = candidates.filter(
    (source) => !hostErrorTracker.isSkipped(hostFromUrl(source.url)),
  );

  counters.attempted = candidates.length;
  if (candidates.length === 0) {
    return { fetchedContentById, droppedByGateIds, counters, fetchEvents };
  }

  const fetchInputs: WebSearchResult[] = candidates.map((source) => ({
    url: source.url,
    title: source.title,
    content: "",
    tickerId: context.tickerId,
    searchQueryId: "",
    searchQueryText: "",
    serpIndex: 0,
  }));

  const outcomes = await performFetch(fetchInputs, {
    config: { providers: expandFetchProviderEntries(config.fetch.providers) },
    ...(log ? { logger: log } : {}),
    hostErrorTracker,
  });

  const persistBody: PostContentGenerationFetchedContentBody = [];
  const fetchFailures: WebFetchFailure[] = [];
  const qualityDrops: QualityDropForDeadUrl[] = [];

  outcomes.forEach((outcome, index) => {
    const source = candidates[index];
    if (!source) {
      return;
    }

    if (outcome.success === null) {
      counters.fetchFailed += 1;
      fetchFailures.push(...outcome.failures);
      fetchEvents.push({
        dataSourceId: source.dataSourceId,
        reason: source.reason ?? "",
        provider: null,
        status: "fetch_failed",
      });
      return;
    }

    counters.fetchSucceeded += 1;
    const page = outcome.success;
    const decision = gate(page.title, page.content, source.url);
    if (decision.blocked) {
      counters.gateDropped += 1;
      droppedByGateIds.add(source.dataSourceId);
      qualityDrops.push({ url: source.url, reason: decision.reason });
      fetchEvents.push({
        dataSourceId: source.dataSourceId,
        reason: source.reason ?? "",
        provider: page.provider,
        status: "gate_dropped",
      });
      return;
    }

    const publishedAt = acceptablePublishedDate(
      extractPublishedDate({
        ...(page.fetchMetadata ? { fetchMetadata: page.fetchMetadata } : {}),
        content: page.content,
        url: source.url,
      }),
    )?.toISOString();

    fetchedContentById.set(source.dataSourceId, {
      content: page.content,
      fetchProvider: page.provider,
      ...(publishedAt ? { publishedAt } : {}),
    });
    persistBody.push({
      dataSourceId: source.dataSourceId,
      content: page.content,
      fetchProvider: page.provider,
      ...(publishedAt ? { publishedAt } : {}),
    });
    fetchEvents.push({
      dataSourceId: source.dataSourceId,
      reason: source.reason ?? "",
      provider: page.provider,
      status: "succeeded",
    });
  });

  if (persistBody.length > 0) {
    const persistResult = await deps.persistFetchedContent(persistBody);
    counters.persisted = persistResult.updatedCount;
  }

  if (
    deadUrlCache.enabled &&
    deps.recordDeadUrls &&
    (fetchFailures.length > 0 || qualityDrops.length > 0)
  ) {
    const records = buildDeadUrlRecords(
      context.tickerId,
      fetchFailures,
      qualityDrops,
    );
    if (records.length > 0) {
      await deps.recordDeadUrls(records);
    }
  }

  return { fetchedContentById, droppedByGateIds, counters, fetchEvents };
}
