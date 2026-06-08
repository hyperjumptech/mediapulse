import type { DataCollectionInput } from "@workspace/agent-types";
import { createAgentDataApiClient } from "@workspace/agent-data-api-client";
import type { AgentRunContext, AgentRunResult } from "@workspace/agent-runtime";
import { env } from "@mediapulse/env/agents-page-collection";
import { logger } from "@workspace/logger";
import got from "got";
import crypto from "node:crypto";

import type { BodySchemaType } from "./utilities/body-schema";
import type { ConfigSchemaType } from "./utilities/config-schema";
import {
  performWebFetch,
  createEmptyQualityCounters,
  runQualityGate,
  resolveExistingDataSourceUrls,
  resolveDeadUrls,
  buildDeadUrlRecords,
  HostErrorTracker,
  hostFromUrl,
  type QualityDropForDeadUrl,
  buildTickerAliases,
  buildIndustryAliases,
  isRelevant,
  deriveRunStatus,
  type RunCounters,
  extractPublishedDate,
  isFresh,
  runDiscovery,
  RateLimiter,
  type DiscoveryCache,
  type DiscoverySource,
  type WebSearchResult,
} from "@workspace/agent-ingestion";
import { classifyNoisyUrl, type UrlNoiseReason } from "@workspace/utils";
import { prefilterByAliases } from "./utilities/prefilter-by-aliases";

/**
 * Executes the page-collection pipeline: discover article links from curated listing
 * sources, pre-filter by ticker/industry aliases, fetch survivors, apply quality/relevance/
 * freshness gates, and persist new data sources under the ticker's curated listing query.
 *
 * @param context - Validated input and config, plus the bearer token for the Agent Data API.
 * @returns Success with summary counts, or semantic failure when the run policy shortfall is hit.
 */
export async function runPageCollection(
  context: AgentRunContext<BodySchemaType, ConfigSchemaType>,
): Promise<AgentRunResult> {
  const { input, config, token, hermesCorrelation } = context;
  const startedAt = new Date();
  const runId = crypto.randomUUID();

  const hermes = hermesCorrelation;
  const log = logger.child({
    component: "page-collection",
    runId,
    tickerId: input.tickerId,
    ...(hermes?.scheduleId ? { scheduleId: hermes.scheduleId } : {}),
    ...(hermes?.scheduleExecutionId
      ? { scheduleExecutionId: hermes.scheduleExecutionId }
      : {}),
    ...(hermes?.pipelineStepId
      ? { pipelineStepId: hermes.pipelineStepId }
      : {}),
  });

  log.info({ runPolicy: config.runPolicy }, "page collection run started");

  const runPolicy = config.runPolicy;
  const webFetchConfig = config.providers.fetch;
  const relevanceGateConfig = config.gates.relevance;
  const deadUrlCacheConfig = config.resilience.deadUrlCache;
  const hostErrorBreakerConfig = config.resilience.hostErrorBreaker;
  const freshnessGateConfig = config.gates.freshness;
  const hostErrorTracker = new HostErrorTracker(hostErrorBreakerConfig);

  const dataApiClient = createAgentDataApiClient({
    baseUrl: env.AGENT_DATA_API_URL,
    version: "v1",
    token,
  });

  const report = (
    title: string,
    description?: string,
    status: "processing" | "completed" = "processing",
  ) => {
    const jobId = hermesCorrelation?.jobId;
    if (jobId && token) {
      void fetch(`${env.AGENT_REGISTRY_URL}/api/agent-activity`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: token },
        body: JSON.stringify({ jobId, title, description, status }),
      }).catch(() => {});
    }
  };

  report("Loading ticker context", `ticker ${input.tickerId}`);

  const tickerRecord = await dataApiClient.ticker.get({
    tickerId: input.tickerId,
  });
  const tickerAliases = buildTickerAliases(
    tickerRecord.symbol,
    tickerRecord.name,
    tickerRecord.aliases,
  );
  const industryAliases = buildIndustryAliases(
    tickerRecord.sector,
    tickerRecord.industry,
  );

  if (tickerAliases.length === 0 && industryAliases.length === 0) {
    log.warn(
      { tickerId: input.tickerId },
      "ticker has no aliases or industry labels; relevance gate is a no-op for this run",
    );
  } else {
    log.info(
      {
        aliasCount: tickerAliases.length,
        industryAliasCount: industryAliases.length,
      },
      "loaded ticker and industry aliases for relevance gate",
    );
  }

  const { searchQueryId } =
    await dataApiClient.dataCollectionCuratedListingQuery.create({
      tickerId: input.tickerId,
    });

  report(
    "Loaded ticker context",
    `${tickerAliases.length} ticker aliases, ${industryAliases.length} industry terms`,
  );

  const discoverySources: DiscoverySource[] = config.curatedSources.map(
    (source) => ({
      url: source.listingUrl,
      strategies: source.strategies ?? config.defaultDiscoveryChain,
      enabled: source.enabled,
      maxItems: source.maxItems,
    }),
  );

  report("Running discovery", `${discoverySources.length} curated sources`);

  const discoveryRateLimiter = new RateLimiter(2, 1);
  const discoveryDeps = {
    gotClient: got,
    rateLimiter: discoveryRateLimiter,
    logger: log,
  };

  const discoveryCacheConfig = config.discoveryCache;
  const discoveryCache: DiscoveryCache | undefined =
    discoveryCacheConfig.enabled
      ? {
          ttlSeconds: discoveryCacheConfig.ttlSeconds,
          lookup: async (listingUrls) => {
            const response =
              await dataApiClient.listingDiscoveryCacheLookup.create({
                listingUrls,
              });
            return response.entries;
          },
          record: async (entries) => {
            await dataApiClient.listingDiscoveryCacheRecord.create(entries);
          },
        }
      : undefined;

  const { items: discoveredItems, failures: discoveryFailures } =
    await runDiscovery(discoverySources, discoveryDeps, discoveryCache);

  log.info(
    {
      discoveredCount: discoveredItems.length,
      discoveryFailureCount: discoveryFailures.length,
    },
    "discovery stage finished",
  );

  const prefilterDropCount =
    discoveredItems.length -
    prefilterByAliases(discoveredItems, {
      tickerAliases,
      industryAliases,
    }).length;
  const filteredItems = prefilterByAliases(discoveredItems, {
    tickerAliases,
    industryAliases,
  });

  log.info(
    {
      filteredCount: filteredItems.length,
      prefilterDropCount,
    },
    "alias pre-filter applied",
  );

  const droppedByUrlReason: Record<UrlNoiseReason, number> = {
    blocked_host: 0,
    blocked_host_path: 0,
    blocked_path: 0,
    blocked_extension: 0,
  };
  let droppedByDuplicateCanonicalUrl = 0;
  let droppedByExistingCanonicalUrl = 0;
  const droppedByContentQuality = createEmptyQualityCounters();
  let droppedByRelevance = 0;
  let droppedByDeadUrlCache = 0;
  let droppedByHostErrorRate = 0;
  let droppedByFreshness = 0;
  let fetchSuccessCount = 0;
  let fetchFailedCount = 0;
  let persistedCount = 0;

  const fetchFailures: Array<
    Awaited<ReturnType<typeof performWebFetch>>[number]["failures"][number]
  > = [];

  const canonicalItemMap = new Map<
    string,
    { searchResult: WebSearchResult; discoveryPublishedAt?: string }
  >();
  for (const item of filteredItems) {
    const decision = classifyNoisyUrl(item.url);
    if (decision.blocked) {
      droppedByUrlReason[decision.reason] += 1;
      continue;
    }

    if (canonicalItemMap.has(decision.canonicalUrl)) {
      droppedByDuplicateCanonicalUrl += 1;
      continue;
    }

    canonicalItemMap.set(decision.canonicalUrl, {
      searchResult: {
        url: decision.canonicalUrl,
        title: item.title ?? "",
        content: "",
        tickerId: input.tickerId,
        searchQueryId,
        searchQueryText: "",
        serpIndex: 0,
      },
      discoveryPublishedAt: item.publishedAt,
    });
  }

  const candidateUrls = [...canonicalItemMap.keys()];
  const { existingUrls: existingUrlSet } = await resolveExistingDataSourceUrls(
    input.tickerId,
    candidateUrls,
    (body) => dataApiClient.dataCollectionExistingUrls.create(body),
  );

  let candidatesAfterExisting = candidateUrls.filter(
    (url) => !existingUrlSet.has(url),
  );
  droppedByExistingCanonicalUrl =
    candidateUrls.length - candidatesAfterExisting.length;

  if (droppedByExistingCanonicalUrl > 0) {
    log.info(
      { droppedByExistingCanonicalUrl },
      "skipped fetch for URLs already stored as data sources",
    );
  }

  let candidatesAfterDeadUrl = candidatesAfterExisting;
  if (deadUrlCacheConfig.enabled) {
    const deadUrlSet = await resolveDeadUrls(
      input.tickerId,
      candidatesAfterExisting,
      (body) => dataApiClient.dataCollectionDeadUrlsLookup.create(body),
      deadUrlCacheConfig.skipLookupBatchSize,
    );
    if (deadUrlSet.size > 0) {
      candidatesAfterDeadUrl = candidatesAfterDeadUrl.filter(
        (url) => !deadUrlSet.has(url),
      );
      droppedByDeadUrlCache =
        candidatesAfterExisting.length - candidatesAfterDeadUrl.length;
      log.info(
        { droppedByDeadUrlCache },
        "skipped fetch for URLs in dead-url negative cache",
      );
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

  if (droppedByHostErrorRate > 0) {
    log.info(
      { droppedByHostErrorRate },
      "skipped fetch for hosts over error-rate threshold",
    );
  }

  report(
    "Fetching article content",
    `${candidatesAfterHostBreaker.length} candidate URLs`,
  );

  const fetchInputs = candidatesAfterHostBreaker
    .map((url) => canonicalItemMap.get(url)?.searchResult)
    .filter((r): r is WebSearchResult => r !== undefined);

  const fetchAttemptResults =
    fetchInputs.length > 0
      ? await performWebFetch(fetchInputs, {
          config: webFetchConfig,
          logger: log,
          hostErrorTracker,
        })
      : [];

  const roundFetchSuccesses = fetchAttemptResults
    .filter((outcome) => outcome.success !== null)
    .map((outcome) => outcome.success!);
  const roundFetchFailures = fetchAttemptResults.flatMap(
    (outcome) => outcome.failures,
  );
  const roundFailedUrlCount = fetchAttemptResults.filter(
    (outcome) => outcome.success === null,
  ).length;
  fetchFailedCount += roundFailedUrlCount;
  fetchFailures.push(...roundFetchFailures);

  const roundQualityDrops: QualityDropForDeadUrl[] = [];

  report(
    "Saving sources to database",
    `${roundFetchSuccesses.length} fetched pages`,
  );

  for (const page of roundFetchSuccesses) {
    const urlDecision = classifyNoisyUrl(page.url);
    if (urlDecision.blocked) {
      droppedByUrlReason[urlDecision.reason] += 1;
      continue;
    }

    const contentDecision = runQualityGate(page.title, page.content, page.url);
    if (contentDecision.blocked) {
      droppedByContentQuality[contentDecision.reason] += 1;
      roundQualityDrops.push({
        url: urlDecision.canonicalUrl,
        reason: contentDecision.reason,
      });
      continue;
    }

    if (relevanceGateConfig.enabled) {
      const relevanceDecision = isRelevant(
        {
          title: page.title,
          content: page.content,
          aliases: tickerAliases,
          industryAliases,
        },
        {
          headChars: relevanceGateConfig.headChars,
          minMatches: relevanceGateConfig.minMatches,
        },
      );
      if (!relevanceDecision.relevant) {
        droppedByRelevance += 1;
        log.info(
          {
            url: page.url.slice(0, 120),
            reason: relevanceDecision.reason,
          },
          "dropped page that did not mention the target ticker or industry",
        );
        continue;
      }
    }

    const extractedDate = extractPublishedDate({
      fetchMetadata: page.fetchMetadata ?? page.jinaMetadata,
      content: page.content,
    });
    const itemEntry = canonicalItemMap.get(urlDecision.canonicalUrl);
    const discoveryPublishedAt = itemEntry?.discoveryPublishedAt;
    const publishedAt =
      extractedDate ??
      (discoveryPublishedAt ? new Date(discoveryPublishedAt) : null);

    if (freshnessGateConfig.enabled) {
      const freshnessDecision = isFresh(publishedAt, {
        maxAgeDays: freshnessGateConfig.maxAgeDays,
        allowUnknown: freshnessGateConfig.allowUnknown,
      });
      if (!freshnessDecision.fresh) {
        droppedByFreshness += 1;
        log.info(
          {
            url: urlDecision.canonicalUrl.slice(0, 120),
            publishedAt: publishedAt?.toISOString() ?? null,
            reason: freshnessDecision.reason,
          },
          "dropped page outside freshness window",
        );
        continue;
      }
    }

    const source: DataCollectionInput = {
      url: urlDecision.canonicalUrl,
      title: page.title,
      content: page.content,
      tickerId: input.tickerId,
      searchQueryId,
      ...(publishedAt ? { publishedAt: publishedAt.toISOString() } : {}),
    };
    log.info(
      { url: urlDecision.canonicalUrl.slice(0, 120) },
      "persisting collected source to Agent Data API",
    );
    await dataApiClient.dataCollection.create([source]);
    persistedCount += 1;
    fetchSuccessCount += 1;
  }

  log.info(
    {
      fetchSuccess: fetchSuccessCount,
      fetchFailed: fetchFailedCount,
      droppedByUrlReason,
      droppedByDuplicateCanonicalUrl,
      droppedByExistingCanonicalUrl,
      droppedByContentQuality,
      droppedByRelevance,
      droppedByDeadUrlCache,
      droppedByHostErrorRate,
      droppedByFreshness,
      prefilterDropCount,
    },
    "fetch stage finished",
  );

  if (deadUrlCacheConfig.enabled) {
    const deadUrlFetchFailures = fetchAttemptResults
      .filter((outcome) => outcome.success === null)
      .flatMap((outcome) => outcome.failures);
    const deadUrlRecords = buildDeadUrlRecords(
      input.tickerId,
      deadUrlFetchFailures,
      roundQualityDrops,
    );
    if (deadUrlRecords.length > 0) {
      try {
        await dataApiClient.dataCollectionDeadUrlsRecord.create(deadUrlRecords);
        log.info(
          { deadUrlRecordCount: deadUrlRecords.length },
          "recorded dead URLs to negative cache",
        );
      } catch (recordError) {
        log.warn(
          { deadUrlRecordCount: deadUrlRecords.length, err: recordError },
          "failed to record dead URLs; continuing without negative cache write",
        );
      }
    }
  }

  const failuresPayload = fetchFailures.map((f) => ({
    id: crypto.randomUUID(),
    runId,
    tickerId: input.tickerId,
    stage: "web-fetch" as const,
    provider: f.provider,
    searchQueryId: f.queryId,
    url: f.url,
    errorCategory: f.errorCategory,
    retryable: f.retryable,
    message: f.message,
    httpStatus: f.httpStatus,
    createdAt: new Date().toISOString(),
  }));

  const totalSources = persistedCount;
  const status = deriveRunStatus({
    totalSources,
    failureCount: failuresPayload.length + discoveryFailures.length,
    runPolicy,
  });

  const counters: RunCounters = {
    queriesTotal: discoverySources.filter((s) => s.enabled !== false).length,
    urlsTotal: discoveredItems.length,
    searchSuccess: discoveredItems.length,
    searchFailed: discoveryFailures.length,
    fetchSuccess: fetchSuccessCount,
    fetchFailed: fetchFailedCount,
    retryCount: 0,
    droppedByRelevance,
    throttleEvents: 0,
  };

  const runPayload = {
    id: runId,
    tickerId: input.tickerId,
    startedAt: startedAt.toISOString(),
    completedAt: new Date().toISOString(),
    status,
    counters,
  };

  await dataApiClient.dataCollectionRun.create(runPayload);

  if (failuresPayload.length > 0) {
    log.warn(
      { failureRecords: failuresPayload.length },
      "recording run failures to Agent Data API",
    );
    await dataApiClient.dataCollectionFailure.create(failuresPayload);
  }

  const summary = {
    totalSources,
    status,
    discoveredCount: discoveredItems.length,
    discoveryFailureCount: discoveryFailures.length,
    prefilterDropCount,
    fetchSuccess: fetchSuccessCount,
    droppedByRelevance,
    droppedByDeadUrlCache,
    droppedByHostErrorRate,
    droppedByFreshness,
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
        discoveryFailureCount: discoveryFailures.length,
      },
      "page collection run completed with policy failure (semantic failure response)",
    );

    report(
      "Page collection complete",
      `${totalSources} saved, ${failuresPayload.length} failed`,
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
      discoveryFailureCount: discoveryFailures.length,
      droppedByRelevance,
      droppedByFreshness,
    },
    completionMessage,
  );

  report(
    "Page collection complete",
    `${totalSources} saved, ${failuresPayload.length} failed`,
    "completed",
  );

  return {
    success: true,
    details: { summary },
  };
}
