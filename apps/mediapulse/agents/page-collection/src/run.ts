import { createAgentDataApiClient } from "@workspace/agent-data-api-client";
import type { AgentRunContext, AgentRunResult } from "@workspace/agent-runtime";
import {
  createActivityReporter,
  createRunLogBuffer,
} from "@workspace/agent-runtime";
import { env } from "@mediapulse/env/agents-page-collection";
import { logger } from "@workspace/logger";
import got from "got";
import crypto from "node:crypto";

import {
  PAGE_COLLECTION_AGENT_ID,
  PAGE_COLLECTION_AGENT_VERSION,
} from "./constants";
import type { BodySchemaType } from "./utilities/body-schema";
import type { ConfigSchemaType } from "./utilities/config-schema";
import { expandSourceUrl } from "./utilities/expand-source-urls";
import { withApiStep } from "./utilities/with-api-step";
import {
  buildRelevanceMatchText,
  createTickerRelevanceMatcher,
  type TickerRelevanceMatcher,
  isJunkTitle,
  hasSufficientDescription,
  createTitleDeduper,
  MIN_DESCRIPTION_CHARS,
  deriveRunStatus,
  type RunPolicy,
  makeDroppedOutcome,
  makeCollectedOutcome,
  postOutcomesInChunks,
  type CollectionUrlOutcomeInput,
  RateLimiter,
  isFresh,
  extractDateFromUrl,
} from "@workspace/agent-ingestion";
import {
  classifyNoisyUrl,
  derivePublisherFromUrl,
  type UrlNoiseReason,
} from "@workspace/utils";
import {
  PAGE_COLLECTION_EXISTING_URLS_MAX,
  type PostPageCollectionBody,
} from "@workspace/agent-data-api-contract";

/** Freshness window in days. Pages older than this are dropped; undated pages are kept. */
const FRESHNESS_MAX_AGE_DAYS = 7;

/** Run success criteria, formerly the configurable runPolicy section. */
const RUN_POLICY: RunPolicy = {
  minSuccessfulSources: 1,
  failOnZeroSuccess: false,
};

/** Dead-URL negative-cache lookup batch size. */
const DEAD_URL_LOOKUP_BATCH_SIZE = 50;

/** Per-strategy HTTP timeout. A hung request is aborted and falls through the strategy chain. */
const DISCOVERY_TIMEOUT_MS = 30_000;

/**
 * Hard wall-clock budget for a single page-collection run. Once exceeded, the run
 * stops persisting new candidates and finalizes with partial_success, so one slow or
 * hostile listing host cannot wedge the run (and the pipeline behind it) for hours.
 */
const RUN_WALL_CLOCK_BUDGET_MS = 5 * 60 * 1000;

/**
 * Executes the page-collection pipeline: expand curated source URLs and persist
 * ticker-agnostic articles from the discovered feed/meta description, with no paid
 * fetch. Articles that discovery yields no description for, or that mention no
 * tracked ticker, are dropped.
 *
 * @param context - Validated input (`listingUrl`) and config, plus bearer token.
 * @returns Success with summary counts.
 */
export async function runPageCollection(
  context: AgentRunContext<BodySchemaType, ConfigSchemaType>,
): Promise<AgentRunResult> {
  const { input, config, token, hermesCorrelation } = context;
  const startedAt = new Date();
  const runId = crypto.randomUUID();
  const scheduleExecutionId =
    hermesCorrelation?.scheduleExecutionId ?? undefined;

  const log = logger.child({
    component: "page-collection",
    runId,
    ...(hermesCorrelation?.scheduleId
      ? { scheduleId: hermesCorrelation.scheduleId }
      : {}),
    ...(hermesCorrelation?.scheduleExecutionId
      ? { scheduleExecutionId: hermesCorrelation.scheduleExecutionId }
      : {}),
  });

  const dataApiClient = createAgentDataApiClient({
    baseUrl: env.AGENT_DATA_API_URL,
    version: "v1",
    token,
  });

  const runLogBuffer = createRunLogBuffer();
  const report = createActivityReporter({
    registryUrl: env.AGENT_REGISTRY_URL,
    jobId: hermesCorrelation?.jobId,
    token,
  });

  try {
    return await executePageCollectionRun({
      input,
      config,
      startedAt,
      runId,
      scheduleExecutionId,
      log,
      runLogBuffer,
      report,
      dataApiClient,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Page collection run failed unexpectedly";
    log.error({ err: error }, "page collection run failed before completion");
    runLogBuffer.append({
      level: "error",
      message,
    });

    const crashSnapshot = {
      agentId: PAGE_COLLECTION_AGENT_ID,
      agentVersion: PAGE_COLLECTION_AGENT_VERSION,
      cost: { searchCredits: 0, searchCreditsByProvider: {} },
      result: { saved: 0, excluded: 0, byReason: {} },
      timing: {
        totalMs: Date.now() - startedAt.getTime(),
        roundsExecuted: 0,
      },
    };
    try {
      await withApiStep("persist crash run record", () =>
        dataApiClient.dataCollectionRun.create({
          id: runId,
          scheduleExecutionId,
          startedAt: startedAt.toISOString(),
          completedAt: new Date().toISOString(),
          status: "failed",
          snapshot: crashSnapshot,
        }),
      );
      await withApiStep("persist page collection crash run record", () =>
        dataApiClient.pageCollectionRun.create({
          id: runId,
          scheduleExecutionId,
          startedAt: startedAt.toISOString(),
          completedAt: new Date().toISOString(),
          status: "failed",
          snapshot: crashSnapshot,
        }),
      );
    } catch (persistError) {
      log.warn({ err: persistError }, "failed to persist crash run record");
    }

    report("Page collection failed", message, "completed");

    const logs = runLogBuffer.toArray();
    return {
      success: false,
      message: `Page collection run failed: ${message}`,
      details: { failureReason: "unexpected_error" as const },
      ...(logs.length > 0 ? { logs } : {}),
    };
  }
}

type PageCollectionLogger = {
  info: (obj: unknown, msg?: string) => void;
  warn: (obj: unknown, msg?: string) => void;
  error: (obj: unknown, msg?: string) => void;
};

type PageCollectionRunDeps = {
  input: BodySchemaType;
  config: ConfigSchemaType;
  startedAt: Date;
  runId: string;
  scheduleExecutionId: string | undefined;
  log: PageCollectionLogger;
  runLogBuffer: ReturnType<typeof createRunLogBuffer>;
  report: ReturnType<typeof createActivityReporter>;
  dataApiClient: ReturnType<typeof createAgentDataApiClient>;
};

/**
 * Core page-collection pipeline (invoked inside error handling wrapper).
 */
async function executePageCollectionRun(
  deps: PageCollectionRunDeps,
): Promise<AgentRunResult> {
  const {
    input,
    config,
    startedAt,
    runId,
    scheduleExecutionId,
    log,
    runLogBuffer,
    report,
    dataApiClient,
  } = deps;
  const outcomes: CollectionUrlOutcomeInput[] = [];

  const listingUrl = input.listingUrl;
  const runPolicy = RUN_POLICY;

  report("Resolving curated source", listingUrl);

  const { sources: resolvedSources } = await withApiStep(
    "resolve curated sources",
    () =>
      dataApiClient.pageCollectionResolveSources.create({
        listingUrls: [listingUrl],
      }),
  );

  const meta = resolvedSources.find((s) => s.listingUrl === listingUrl);

  const discoveryDeps = {
    gotClient: got,
    rateLimiter: new RateLimiter(2, 1),
    logger: log,
    timeoutMs: DISCOVERY_TIMEOUT_MS,
  };

  report("Expanding source URL", listingUrl);

  type CandidateItem = {
    url: string;
    sourceListingUrl: string;
    curatedSourceId?: string;
    publishedAt?: string;
    title?: string;
    description?: string;
  };

  const expanded = await expandSourceUrl(listingUrl, discoveryDeps, {
    maxItems: meta?.maxItems ?? undefined,
    linkType: meta?.linkType,
  });

  const allCandidates: CandidateItem[] = expanded.map((item) => ({
    url: item.url,
    sourceListingUrl: listingUrl,
    ...(meta?.curatedSourceId ? { curatedSourceId: meta.curatedSourceId } : {}),
    ...(item.publishedAt ? { publishedAt: item.publishedAt } : {}),
    ...(item.title ? { title: item.title } : {}),
    ...(item.summary ? { description: item.summary } : {}),
  }));

  if (allCandidates.length === 0) {
    log.warn({ listingUrl }, "page collection discovered zero candidate URLs");
    runLogBuffer.append({
      level: "warn",
      message: "Zero candidate URLs discovered",
      context: { listingUrl },
    });
  }

  const collectionConfig = config.collection;
  const deadline = startedAt.getTime() + RUN_WALL_CLOCK_BUDGET_MS;
  let deadlineHit = false;

  const maxDiscoveredItems = collectionConfig.maxDiscoveredItemsPerRun;
  const droppedByRunItemCap = Math.max(
    0,
    allCandidates.length - maxDiscoveredItems,
  );
  const cappedCandidates = allCandidates.slice(0, maxDiscoveredItems);

  const droppedByUrlReason: Record<UrlNoiseReason, number> = {
    blocked_host: 0,
    low_value_source: 0,
    blocked_host_path: 0,
    blocked_path: 0,
    blocked_extension: 0,
    site_homepage: 0,
    non_article_page: 0,
    non_editorial_page: 0,
    opaque_redirect: 0,
  };
  let droppedByDuplicateCanonicalUrl = 0;
  let droppedByExistingCanonicalUrl = 0;
  let droppedByMissingDescription = 0;
  let droppedByShortDescription = 0;
  let droppedByJunkTitle = 0;
  let droppedByDuplicateTitle = 0;
  let droppedByDeadUrlCache = 0;
  let droppedByFreshness = 0;
  let droppedByRelevance = 0;
  let relevanceMatchedCount = 0;
  let persistedCount = 0;

  const relevanceMatcher = await loadTickerRelevanceMatcher(
    dataApiClient,
    log,
    runLogBuffer,
  );

  const canonicalItemMap = new Map<string, CandidateItem>();

  for (const item of cappedCandidates) {
    const decision = classifyNoisyUrl(item.url);
    if (decision.blocked) {
      droppedByUrlReason[decision.reason] += 1;
      outcomes.push(
        makeDroppedOutcome(
          {
            id: crypto.randomUUID(),
            scheduleExecutionId,
            runId,
            agent: "page-collection",
            url: item.url,
            source: item.sourceListingUrl,
            curatedSourceId: item.curatedSourceId,
            createdAt: new Date().toISOString(),
          },
          { reason: `url_noise_${decision.reason}`, detail: item.url },
        ),
      );
      continue;
    }

    if (canonicalItemMap.has(decision.canonicalUrl)) {
      droppedByDuplicateCanonicalUrl += 1;
      continue;
    }

    canonicalItemMap.set(decision.canonicalUrl, {
      ...item,
      url: decision.canonicalUrl,
    });
  }

  const candidateUrls = [...canonicalItemMap.keys()];

  const existingUrlSet = new Set<string>();
  for (
    let index = 0;
    index < candidateUrls.length;
    index += PAGE_COLLECTION_EXISTING_URLS_MAX
  ) {
    const chunk = candidateUrls.slice(
      index,
      index + PAGE_COLLECTION_EXISTING_URLS_MAX,
    );
    const response = await withApiStep("lookup existing canonical URLs", () =>
      dataApiClient.pageCollectionExistingUrls.create({ urls: chunk }),
    );
    for (const url of response.existingUrls) {
      existingUrlSet.add(url);
    }
  }

  let candidatesAfterExisting = candidateUrls.filter(
    (url) => !existingUrlSet.has(url),
  );
  droppedByExistingCanonicalUrl =
    candidateUrls.length - candidatesAfterExisting.length;

  let candidatesAfterDeadUrl = candidatesAfterExisting;
  const deadUrlSet = await resolveDeadUrlsGlobal(
    candidatesAfterExisting,
    (body) =>
      withApiStep("lookup dead URLs", () =>
        dataApiClient.dataCollectionDeadUrlsLookup.create(body),
      ),
    DEAD_URL_LOOKUP_BATCH_SIZE,
  );
  if (deadUrlSet.size > 0) {
    candidatesAfterDeadUrl = candidatesAfterDeadUrl.filter(
      (url) => !deadUrlSet.has(url),
    );
    droppedByDeadUrlCache =
      candidatesAfterExisting.length - candidatesAfterDeadUrl.length;
  }

  const perRunCandidateBudget = collectionConfig.perRunCandidateBudget;
  const droppedByCandidateBudget = Math.max(
    0,
    candidatesAfterDeadUrl.length - perRunCandidateBudget,
  );
  const candidatesAfterBudget = candidatesAfterDeadUrl.slice(
    0,
    perRunCandidateBudget,
  );

  report(
    "Screening candidates",
    `Checking ${candidatesAfterBudget.length} candidate URL${
      candidatesAfterBudget.length === 1 ? "" : "s"
    } against the freshness, relevance, and article-shape gates.`,
  );

  if (Date.now() > deadline) {
    deadlineHit = true;
  }

  const candidatesToPersist = deadlineHit ? [] : candidatesAfterBudget;
  const sourcesToPersist: PostPageCollectionBody = [];
  const titleDeduper = createTitleDeduper();

  for (const url of candidatesToPersist) {
    const item = canonicalItemMap.get(url);
    if (!item) {
      continue;
    }

    const outcomeBase = {
      id: crypto.randomUUID(),
      scheduleExecutionId,
      runId,
      agent: "page-collection" as const,
      url,
      source: item.sourceListingUrl,
      curatedSourceId: item.curatedSourceId,
      createdAt: new Date().toISOString(),
    };

    const title = item.title ?? "";
    if (isJunkTitle(title)) {
      droppedByJunkTitle += 1;
      outcomes.push(
        makeDroppedOutcome(outcomeBase, { reason: "junk_title", title }),
      );
      continue;
    }

    if (titleDeduper.isDuplicate(title)) {
      droppedByDuplicateTitle += 1;
      outcomes.push(
        makeDroppedOutcome(outcomeBase, { reason: "duplicate_title", title }),
      );
      continue;
    }

    const description = item.description?.trim();
    if (!description) {
      droppedByMissingDescription += 1;
      outcomes.push(
        makeDroppedOutcome(outcomeBase, { reason: "empty_description" }),
      );
      continue;
    }

    if (!hasSufficientDescription(description)) {
      droppedByShortDescription += 1;
      outcomes.push(
        makeDroppedOutcome(outcomeBase, {
          reason: "description_too_short",
          charCount: description.length,
          minChars: MIN_DESCRIPTION_CHARS,
        }),
      );
      continue;
    }

    const feedPublishedAt = item.publishedAt
      ? new Date(item.publishedAt)
      : null;
    const publishedAt =
      feedPublishedAt && !isNaN(feedPublishedAt.getTime())
        ? feedPublishedAt
        : extractDateFromUrl(url);
    const freshnessDecision = isFresh(publishedAt, {
      maxAgeDays: FRESHNESS_MAX_AGE_DAYS,
      allowUnknown: true,
    });
    if (!freshnessDecision.fresh) {
      droppedByFreshness += 1;
      const freshnessContext =
        freshnessDecision.reason === "too_old" && publishedAt
          ? {
              reason: "freshness_too_old" as const,
              publishedAt,
              maxAgeDays: FRESHNESS_MAX_AGE_DAYS,
            }
          : freshnessDecision.reason === "future_dated" && publishedAt
            ? { reason: "freshness_future_dated" as const, publishedAt }
            : { reason: "freshness_unknown_date" as const };
      outcomes.push(makeDroppedOutcome(outcomeBase, freshnessContext));
      continue;
    }

    const relevanceText = buildRelevanceMatchText(title, description);
    const relevanceMatch = relevanceMatcher.match(relevanceText);
    if (!relevanceMatch) {
      droppedByRelevance += 1;
      outcomes.push(
        makeDroppedOutcome(outcomeBase, {
          reason: "relevance_no_match",
          matchTextChars: relevanceText.length,
        }),
      );
      continue;
    }
    relevanceMatchedCount += 1;

    const resolvedSource = derivePublisherFromUrl(url);
    sourcesToPersist.push({
      url,
      title,
      description,
      ...(resolvedSource ? { source: resolvedSource } : {}),
      curatedSourceListingUrl: item.sourceListingUrl,
      tickerId: relevanceMatch.tickerId,
      dataCollectionRunId: runId,
      collectionGateStatus: "passed",
      ...(publishedAt ? { publishedAt: publishedAt.toISOString() } : {}),
    });
    outcomes.push(
      makeCollectedOutcome({
        ...outcomeBase,
        tickerId: relevanceMatch.tickerId,
      }),
    );
  }

  const relevanceEvaluatedCount = relevanceMatchedCount + droppedByRelevance;
  log.info(
    {
      relevanceEvaluatedCount,
      relevanceMatchedCount,
      relevanceUnmatchedCount: droppedByRelevance,
    },
    "page collection ticker relevance filtering summary",
  );
  if (droppedByRelevance > 0) {
    runLogBuffer.append({
      level: "info",
      message: `Dropped ${droppedByRelevance} of ${relevanceEvaluatedCount} candidates with no tracked-ticker mention`,
      context: {
        relevanceMatchedCount,
        relevanceUnmatchedCount: droppedByRelevance,
      },
    });
  }

  if (sourcesToPersist.length > 0) {
    const result = await withApiStep("persist articles", () =>
      dataApiClient.pageCollection.create(sourcesToPersist),
    );
    persistedCount += result.persistedCount;
  }

  const totalSources = persistedCount;
  const derivedStatus = deriveRunStatus({
    totalSources,
    failureCount: 0,
    runPolicy,
  });
  const status =
    deadlineHit && derivedStatus === "success"
      ? "partial_success"
      : derivedStatus;

  const byReason: Record<string, number> = {
    existing: droppedByExistingCanonicalUrl,
    duplicate: droppedByDuplicateCanonicalUrl,
    urlNoise: Object.values(droppedByUrlReason).reduce((sum, n) => sum + n, 0),
    missingDescription: droppedByMissingDescription,
    shortDescription: droppedByShortDescription,
    junkTitle: droppedByJunkTitle,
    duplicateTitle: droppedByDuplicateTitle,
    freshness: droppedByFreshness,
    relevance: droppedByRelevance,
    deadUrl: droppedByDeadUrlCache,
    candidateBudget: droppedByCandidateBudget,
    runItemCap: droppedByRunItemCap,
  };

  const snapshot = {
    agentId: PAGE_COLLECTION_AGENT_ID,
    agentVersion: PAGE_COLLECTION_AGENT_VERSION,
    cost: {
      searchCredits: 0,
      searchCreditsByProvider: {},
    },
    result: {
      saved: persistedCount,
      excluded: Object.values(byReason).reduce((sum, n) => sum + n, 0),
      byReason,
    },
    timing: {
      totalMs: Date.now() - startedAt.getTime(),
      roundsExecuted: 1,
      ...(deadlineHit ? { stopReason: "deadline_hit" } : {}),
    },
  };

  await withApiStep("persist run record", () =>
    dataApiClient.dataCollectionRun.create({
      id: runId,
      scheduleExecutionId,
      startedAt: startedAt.toISOString(),
      completedAt: new Date().toISOString(),
      status,
      snapshot,
    }),
  );

  await withApiStep("persist page collection run record", () =>
    dataApiClient.pageCollectionRun.create({
      id: runId,
      scheduleExecutionId,
      startedAt: startedAt.toISOString(),
      completedAt: new Date().toISOString(),
      status,
      snapshot,
    }),
  );

  if (outcomes.length > 0) {
    try {
      await postOutcomesInChunks(outcomes, (batch) =>
        withApiStep("post collection URL outcomes", () =>
          dataApiClient.collectionUrlOutcome.create(batch),
        ),
      );
    } catch (outcomeError) {
      log.warn({ err: outcomeError }, "failed to post collection URL outcomes");
    }
  }

  const summary = {
    totalSources,
    status,
    discoveredCount: allCandidates.length,
    persisted: persistedCount,
    droppedByMissingDescription,
    droppedByShortDescription,
    droppedByJunkTitle,
    droppedByDuplicateTitle,
    droppedByFreshness,
    droppedByRelevance,
    relevanceMatchedCount,
    droppedByDeadUrlCache,
    droppedByCandidateBudget,
    droppedByExistingCanonicalUrl,
    droppedByDuplicateCanonicalUrl,
    droppedByUrlNoise: Object.values(droppedByUrlReason).reduce(
      (sum, n) => sum + n,
      0,
    ),
    droppedByRunItemCap,
    deadlineHit,
  };

  const durationMs = Date.now() - startedAt.getTime();

  const completionMessage =
    status === "partial_success"
      ? "page collection run completed with partial success"
      : "page collection run completed successfully";

  log.info(
    {
      status,
      durationMs,
      totalSources,
    },
    completionMessage,
  );

  if (status === "partial_success") {
    runLogBuffer.append({
      level: "warn",
      message: completionMessage,
      context: { persisted: totalSources },
    });
  }

  const dropParts: string[] = [];
  if (droppedByRelevance > 0) {
    dropParts.push(`${droppedByRelevance} never mentioned a tracked ticker`);
  }
  const droppedByNonArticleUrl =
    droppedByUrlReason.site_homepage +
    droppedByUrlReason.non_article_page +
    droppedByUrlReason.opaque_redirect;
  if (droppedByNonArticleUrl > 0) {
    dropParts.push(`${droppedByNonArticleUrl} were not articles`);
  }
  if (droppedByFreshness > 0) {
    dropParts.push(`${droppedByFreshness} were stale`);
  }
  const droppedByThinDescription =
    droppedByMissingDescription + droppedByShortDescription;
  if (droppedByThinDescription > 0) {
    dropParts.push(`${droppedByThinDescription} had too little text`);
  }
  const droppedByDuplicate =
    droppedByDuplicateCanonicalUrl + droppedByDuplicateTitle;
  if (droppedByDuplicate > 0) {
    dropParts.push(`${droppedByDuplicate} were duplicates`);
  }

  const savedClause =
    totalSources > 0
      ? `Saved ${totalSources} new source${totalSources === 1 ? "" : "s"}`
      : "No new sources were saved";
  const dropClause =
    dropParts.length > 0
      ? `; dropped ${
          dropParts.length === 1
            ? dropParts[0]
            : `${dropParts.slice(0, -1).join(", ")} and ${dropParts[dropParts.length - 1]}`
        }`
      : "";

  report(
    "Page collection complete",
    `${savedClause}${dropClause}.`,
    "completed",
  );

  const completionLogs = runLogBuffer.toArray();
  return {
    success: true,
    details: { summary },
    ...(completionLogs.length > 0 ? { logs: completionLogs } : {}),
  };
}

/**
 * Loads the ticker relevance matcher for this run.
 *
 * - Important: the gate fails closed. When terms cannot be loaded there is
 *   nothing to match against, so the run stops rather than collecting
 *   unfiltered candidates or blaming them for an infrastructure failure.
 *
 * @param dataApiClient - Agent Data API client.
 * @param log - Run logger.
 * @param runLogBuffer - Buffer surfaced on the agent response.
 * @returns A matcher with at least one compiled term.
 * @throws When the terms cannot be loaded or contain no usable term.
 */
async function loadTickerRelevanceMatcher(
  dataApiClient: ReturnType<typeof createAgentDataApiClient>,
  log: PageCollectionLogger,
  runLogBuffer: ReturnType<typeof createRunLogBuffer>,
): Promise<TickerRelevanceMatcher> {
  const { tickers } = await withApiStep("load ticker relevance terms", () =>
    dataApiClient.tickerRelevanceTerms.get({}),
  );
  const matcher = createTickerRelevanceMatcher(tickers);
  if (matcher.isEmpty) {
    log.warn(
      { tickerCount: tickers.length },
      "ticker relevance terms are empty; aborting run",
    );
    runLogBuffer.append({
      level: "warn",
      message: "Ticker relevance terms are empty; run aborted",
      context: { tickerCount: tickers.length },
    });

    throw new Error(
      "Ticker relevance terms are empty; refusing to collect unfiltered candidates.",
    );
  }

  return matcher;
}

/**
 * Global dead-URL lookup without ticker scope.
 *
 * @param candidateUrls - URLs to check against the negative cache.
 * @param lookupDeadUrls - Injected Agent Data API lookup.
 * @param batchSize - Batch size per request.
 */
async function resolveDeadUrlsGlobal(
  candidateUrls: readonly string[],
  lookupDeadUrls: (body: { urls: string[] }) => Promise<{ deadUrls: string[] }>,
  batchSize: number,
): Promise<Set<string>> {
  const unique = [...new Set(candidateUrls)];
  const dead = new Set<string>();

  for (let index = 0; index < unique.length; index += batchSize) {
    const chunk = unique.slice(index, index + batchSize);
    const response = await lookupDeadUrls({ urls: chunk });
    for (const url of response.deadUrls) {
      dead.add(url);
    }
  }

  return dead;
}
