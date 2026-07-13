import {
  buildDeadUrlRecords,
  HostErrorTracker,
  hostFromUrl,
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
  PostContentGenerationFetchedContentBody,
  PostDataCollectionDeadUrlsRecordBody,
} from "@workspace/agent-data-api-contract";

import type { ResolvedContentGenerationConfig } from "./config-schema.js";

export type RequestedFetchSource = {
  dataSourceId: string;
  url: string;
  title: string;
  sectionScore?: number | null;
};

export type FetchedBody = {
  content: string;
  fetchProvider: string;
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
      const scoreDiff =
        (b.source.sectionScore ?? 0) - (a.source.sectionScore ?? 0);
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

  if (requested.length === 0) {
    return { fetchedContentById, droppedByGateIds, counters };
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
    return { fetchedContentById, droppedByGateIds, counters };
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
    config: config.fetch,
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
      return;
    }

    counters.fetchSucceeded += 1;
    const page = outcome.success;
    const decision = gate(page.title, page.content, source.url);
    if (decision.blocked) {
      counters.gateDropped += 1;
      droppedByGateIds.add(source.dataSourceId);
      qualityDrops.push({ url: source.url, reason: decision.reason });
      return;
    }

    fetchedContentById.set(source.dataSourceId, {
      content: page.content,
      fetchProvider: page.provider,
    });
    persistBody.push({
      dataSourceId: source.dataSourceId,
      content: page.content,
      fetchProvider: page.provider,
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

  return { fetchedContentById, droppedByGateIds, counters };
}
