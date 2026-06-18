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

import type { BodySchemaType } from "./utilities/body-schema";
import type { ConfigSchemaType } from "./utilities/config-schema";
import { expandSourceUrl } from "./utilities/expand-source-urls";
import { withApiStep } from "./utilities/with-api-step";
import {
  performWebFetch,
  createEmptyQualityCounters,
  runQualityGate,
  buildDeadUrlRecords,
  HostErrorTracker,
  hostFromUrl,
  type QualityDropForDeadUrl,
  deriveRunStatus,
  type RunCounters,
  type WebSearchResult,
  makeDroppedOutcome,
  makeCollectedOutcome,
  makeFailedOutcome,
  postOutcomesInChunks,
  type CollectionUrlOutcomeInput,
  RateLimiter,
} from "@workspace/agent-ingestion";
import { classifyNoisyUrl, type UrlNoiseReason } from "@workspace/utils";
import {
  PAGE_COLLECTION_EXISTING_URLS_MAX,
  type PostPageCollectionBody,
} from "@workspace/agent-data-api-contract";

/**
 * Executes the page-collection pipeline: expand curated source URLs, fetch article
 * content, apply the content quality gate, and persist ticker-agnostic articles.
 *
 * @param context - Validated input (`listingUrl`) and config, plus bearer token.
 * @returns Success with summary counts, or semantic failure when run policy is not met.
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

    try {
      await withApiStep("persist crash run record", () =>
        dataApiClient.dataCollectionRun.create({
          id: runId,
          scheduleExecutionId,
          startedAt: startedAt.toISOString(),
          completedAt: new Date().toISOString(),
          status: "failed",
          counters: {
            queriesTotal: 0,
            urlsTotal: 0,
            searchSuccess: 0,
            searchFailed: 0,
            fetchSuccess: 0,
            fetchFailed: 0,
            retryCount: 0,
            droppedByRelevance: 0,
            throttleEvents: 0,
            durationMs: Date.now() - startedAt.getTime(),
            agentId: "page-collection",
          },
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
  const runPolicy = config.runPolicy;
  const webFetchConfig = config.providers.fetch;
  const deadUrlCacheConfig = config.resilience.deadUrlCache;
  const hostErrorBreakerConfig = config.resilience.hostErrorBreaker;
  const hostErrorTracker = new HostErrorTracker(hostErrorBreakerConfig);

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
    hostErrorTracker,
    timeoutMs: config.discovery.timeoutMs,
    concurrency: config.discovery.concurrency,
  };

  report("Expanding source URL", listingUrl);

  type CandidateItem = {
    url: string;
    sourceListingUrl: string;
    curatedSourceId?: string;
    publishedAt?: string;
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
  const runConfig = config.run;
  const deadline = startedAt.getTime() + runConfig.maxDurationMs;
  let deadlineHit = false;

  const maxDiscoveredItems = collectionConfig.maxDiscoveredItemsPerRun;
  const droppedByRunItemCap = Math.max(
    0,
    allCandidates.length - maxDiscoveredItems,
  );
  const cappedCandidates = allCandidates.slice(0, maxDiscoveredItems);

  const droppedByUrlReason: Record<UrlNoiseReason, number> = {
    blocked_host: 0,
    blocked_host_path: 0,
    blocked_path: 0,
    blocked_extension: 0,
  };
  let droppedByDuplicateCanonicalUrl = 0;
  let droppedByExistingCanonicalUrl = 0;
  const droppedByContentQuality = createEmptyQualityCounters();
  let droppedByDeadUrlCache = 0;
  let droppedByHostErrorRate = 0;
  let fetchSuccessCount = 0;
  let fetchFailedCount = 0;
  let persistedCount = 0;

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
  if (deadUrlCacheConfig.enabled) {
    const deadUrlSet = await resolveDeadUrlsGlobal(
      candidatesAfterExisting,
      (body) =>
        withApiStep("lookup dead URLs", () =>
          dataApiClient.dataCollectionDeadUrlsLookup.create(body),
        ),
      deadUrlCacheConfig.skipLookupBatchSize,
    );
    if (deadUrlSet.size > 0) {
      candidatesAfterDeadUrl = candidatesAfterDeadUrl.filter(
        (url) => !deadUrlSet.has(url),
      );
      droppedByDeadUrlCache =
        candidatesAfterExisting.length - candidatesAfterDeadUrl.length;
    }
  }

  const candidatesAfterHostBreaker = candidatesAfterDeadUrl.filter((url) => {
    const host = hostFromUrl(url);
    if (hostErrorTracker.isSkipped(host)) {
      droppedByHostErrorRate += 1;
      return false;
    }
    return true;
  });

  const perRunFetchBudget = collectionConfig.perRunFetchBudget;
  const droppedByFetchBudget = Math.max(
    0,
    candidatesAfterHostBreaker.length - perRunFetchBudget,
  );
  const candidatesAfterBudget = candidatesAfterHostBreaker.slice(
    0,
    perRunFetchBudget,
  );

  report(
    "Fetching article content",
    `${candidatesAfterBudget.length} candidate URLs`,
  );

  if (Date.now() > deadline) {
    deadlineHit = true;
  }

  const fetchInputs = !deadlineHit
    ? candidatesAfterBudget
        .map((url) => {
          const item = canonicalItemMap.get(url);
          if (!item) return undefined;
          return {
            url,
            title: "",
            content: "",
            tickerId: "",
            searchQueryId: "",
            searchQueryText: "",
            serpIndex: 0,
          } satisfies WebSearchResult;
        })
        .filter((r): r is WebSearchResult => r !== undefined)
    : [];

  const fetchAttemptResults =
    fetchInputs.length > 0
      ? await performWebFetch(fetchInputs, {
          config: webFetchConfig,
          logger: log,
          hostErrorTracker,
        })
      : [];

  const roundQualityDrops: QualityDropForDeadUrl[] = [];
  const sourcesToPersist: PostPageCollectionBody = [];
  const fetchFailures: Array<
    Awaited<ReturnType<typeof performWebFetch>>[number]["failures"][number]
  > = [];

  for (const outcome of fetchAttemptResults) {
    if (outcome.success === null) {
      fetchFailedCount += 1;
      fetchFailures.push(...outcome.failures);
      continue;
    }

    const page = outcome.success;
    const urlDecision = classifyNoisyUrl(page.url);
    const item = canonicalItemMap.get(urlDecision.canonicalUrl);

    const contentDecision = runQualityGate(page.title, page.content, page.url);
    if (contentDecision.blocked) {
      droppedByContentQuality[contentDecision.reason] += 1;
      roundQualityDrops.push({
        url: urlDecision.canonicalUrl,
        reason: contentDecision.reason,
      });
      outcomes.push(
        makeDroppedOutcome(
          {
            id: crypto.randomUUID(),
            scheduleExecutionId,
            runId,
            agent: "page-collection",
            url: urlDecision.canonicalUrl,
            source: item?.sourceListingUrl,
            curatedSourceId: item?.curatedSourceId,
            createdAt: new Date().toISOString(),
          },
          { reason: contentDecision.reason },
        ),
      );
      continue;
    }

    sourcesToPersist.push({
      url: urlDecision.canonicalUrl,
      title: page.title,
      content: page.content,
      curatedSourceListingUrl:
        item?.sourceListingUrl ?? urlDecision.canonicalUrl,
      collectionGateStatus: "passed",
      metadata: { provider: page.provider },
    });
    fetchSuccessCount += 1;
    outcomes.push(
      makeCollectedOutcome({
        id: crypto.randomUUID(),
        scheduleExecutionId,
        runId,
        agent: "page-collection",
        url: urlDecision.canonicalUrl,
        source: item?.sourceListingUrl,
        curatedSourceId: item?.curatedSourceId,
        createdAt: new Date().toISOString(),
      }),
    );
  }

  if (sourcesToPersist.length > 0) {
    const result = await withApiStep("persist articles", () =>
      dataApiClient.pageCollection.create(sourcesToPersist),
    );
    persistedCount += result.persistedCount;
  }

  if (deadUrlCacheConfig.enabled) {
    const deadUrlRecords = buildDeadUrlRecords(
      undefined,
      fetchFailures,
      roundQualityDrops,
    );
    if (deadUrlRecords.length > 0) {
      try {
        await withApiStep("record dead URLs", () =>
          dataApiClient.dataCollectionDeadUrlsRecord.create(deadUrlRecords),
        );
      } catch (recordError) {
        log.warn({ err: recordError }, "failed to record dead URLs");
      }
    }
  }

  const failuresPayload = fetchFailures.map((f) => ({
    id: crypto.randomUUID(),
    runId,
    stage: "web-fetch" as const,
    provider: f.provider,
    url: f.url,
    errorCategory: f.errorCategory,
    retryable: f.retryable,
    message: f.message,
    httpStatus: f.httpStatus,
    createdAt: new Date().toISOString(),
  }));

  for (const failure of fetchFailures) {
    if (failure.url) {
      const item = canonicalItemMap.get(failure.url);
      outcomes.push(
        makeFailedOutcome(
          {
            id: crypto.randomUUID(),
            scheduleExecutionId,
            runId,
            agent: "page-collection",
            url: failure.url,
            source: item?.sourceListingUrl,
            createdAt: new Date().toISOString(),
          },
          failure.errorCategory,
          failure.httpStatus,
        ),
      );
    }
  }

  const totalSources = persistedCount;
  const derivedStatus = deriveRunStatus({
    totalSources,
    failureCount: failuresPayload.length,
    runPolicy,
  });
  const status =
    deadlineHit && derivedStatus === "success"
      ? "partial_success"
      : derivedStatus;

  const counters: RunCounters = {
    queriesTotal: 1,
    urlsTotal: cappedCandidates.length,
    searchSuccess: allCandidates.length,
    searchFailed: 0,
    fetchSuccess: fetchSuccessCount,
    fetchFailed: fetchFailedCount,
    retryCount: 0,
    droppedByRelevance: 0,
    throttleEvents: 0,
    discovered: allCandidates.length,
    afterPrefilter: cappedCandidates.length,
    discoveryFailed: 0,
    cacheHits: 0,
    cacheMisses: 0,
    droppedByContentQuality: { ...droppedByContentQuality },
    droppedByFreshness: 0,
    droppedByDeadUrl: droppedByDeadUrlCache,
    droppedByHostErrorRate,
    droppedByFetchBudget,
    droppedByRunItemCap,
    droppedByExistingCanonicalUrl,
    droppedByDuplicateCanonicalUrl,
    droppedByUrlNoise: Object.values(droppedByUrlReason).reduce(
      (sum, n) => sum + n,
      0,
    ),
    persisted: persistedCount,
    deadlineHit,
    durationMs: Date.now() - startedAt.getTime(),
    agentId: "page-collection",
  };

  await withApiStep("persist run record", () =>
    dataApiClient.dataCollectionRun.create({
      id: runId,
      scheduleExecutionId,
      startedAt: startedAt.toISOString(),
      completedAt: new Date().toISOString(),
      status,
      counters,
    }),
  );

  if (failuresPayload.length > 0) {
    log.warn(
      { failureRecords: failuresPayload.length, fetchFailed: fetchFailedCount },
      "recording page collection fetch failures",
    );
    await withApiStep("record fetch failures", () =>
      dataApiClient.dataCollectionFailure.create(failuresPayload),
    );
  }

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
    fetchSuccess: fetchSuccessCount,
    fetchFailed: fetchFailedCount,
    droppedByContentQuality,
    droppedByDeadUrlCache,
    droppedByFetchBudget,
    deadlineHit,
  };

  const durationMs = Date.now() - startedAt.getTime();

  if (status === "failed") {
    const minRequired = runPolicy.minSuccessfulSources;
    const message =
      totalSources === 0
        ? `Page collection run failed: no sources were successfully collected, but the run policy requires at least ${minRequired} successful source${minRequired === 1 ? "" : "s"}.`
        : `Page collection run failed: only ${totalSources} successful source${totalSources === 1 ? "" : "s"} collected, but the run policy requires at least ${minRequired}.`;

    log.warn(
      {
        status,
        durationMs,
        totalSources,
        minRequired,
        failureCount: failuresPayload.length,
      },
      "page collection run completed with policy failure",
    );

    report(
      "Page collection complete",
      `${totalSources} persisted, policy failure`,
      "completed",
    );

    return {
      success: false,
      message,
      details: {
        summary,
        failureReason: "insufficient_successful_sources" as const,
        requiredSuccessfulSources: minRequired,
        collectedSuccessfulSources: totalSources,
      },
      ...(runLogBuffer.toArray().length > 0
        ? { logs: runLogBuffer.toArray() }
        : {}),
    };
  }

  const completionMessage =
    status === "partial_success"
      ? "page collection run completed with partial success"
      : "page collection run completed successfully";

  log.info(
    {
      status,
      durationMs,
      totalSources,
      failureCount: failuresPayload.length,
    },
    completionMessage,
  );

  if (fetchFailedCount > 0 || status === "partial_success") {
    runLogBuffer.append({
      level: "warn",
      message: completionMessage,
      context: { fetchFailed: fetchFailedCount, persisted: totalSources },
    });
  }

  report("Page collection complete", `${totalSources} persisted`, "completed");

  const completionLogs = runLogBuffer.toArray();
  return {
    success: true,
    details: { summary },
    ...(completionLogs.length > 0 ? { logs: completionLogs } : {}),
  };
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
