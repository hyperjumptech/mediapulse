import type { DataCollectionInput } from "@workspace/agent-types";
import { createAgentDataApiClient } from "@workspace/agent-data-api-client";
import type { AgentRunContext, AgentRunResult } from "@workspace/agent-runtime";
import { env } from "@mediapulse/env/agents-data-collection";
import { logger } from "@workspace/logger";
import crypto from "node:crypto";

import type { BodySchemaType } from "./utilities/body-schema";
import type { ConfigSchemaType } from "./utilities/config-schema";
import {
  narrativeRunStart,
  narrativeQueriesLoaded,
  narrativeDailyQuota,
  narrativeSearchRound,
  narrativeFilteredResults,
  narrativeFetchStart,
  narrativeSavingSources,
  narrativeRunComplete,
} from "./utilities/build-activity-narrative";
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
  type FetchedWebSearchResult,
  buildTickerAliases,
  buildIndustryAliases,
  isRelevant,
  deriveRunStatus,
  type RunCounters,
  extractPublishedDate,
  isFresh,
} from "@workspace/agent-ingestion";
import {
  performWebSearch,
  type WebSearchEmptyResult,
  type WebSearchFailure,
} from "./utilities/web-search";
import { classifyNoisyUrl, type UrlNoiseReason } from "@workspace/utils";

/**
 * Executes the data-collection pipeline: load search queries, run web search and fetch,
 * persist sources and failures, and record run metadata.
 *
 * @param context - Validated `input` and `config`, plus the bearer `token` for the Agent Data API.
 * @returns Success with summary counts, or semantic failure (`success: false`) when the run status is `failed`
 *   (run policy required more successful sources than were collected; Hermes maps this to HTTP 200 + envelope
 *   so pipeline execution shows the message; do not throw for this case).
 */
export async function runDataCollection(
  context: AgentRunContext<BodySchemaType, ConfigSchemaType>,
): Promise<AgentRunResult> {
  const { input, config, token, hermesCorrelation } = context;
  const startedAt = new Date();
  const runId = crypto.randomUUID();

  const hermes = hermesCorrelation;
  const log = logger.child({
    component: "data-collection",
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

  log.info(
    {
      runPolicy: config.runPolicy,
    },
    "data collection run started",
  );

  const runPolicy = config.runPolicy;
  const targetDailySuccessfulSources =
    config.collection.targetDailySuccessfulSources;
  const maxRefillRounds = config.collection.maxRefillRounds;
  const maxTotalRounds = 1 + maxRefillRounds;

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
  const subject = { symbol: tickerRecord.symbol, name: tickerRecord.name };

  report(...narrativeRunStart(subject));

  const webSearchConfig = config.providers.search;
  const webFetchConfig = config.providers.fetch;
  const relevanceGateConfig = config.gates.relevance;
  const deadUrlCacheConfig = config.resilience.deadUrlCache;
  const hostErrorBreakerConfig = config.resilience.hostErrorBreaker;
  const freshnessGateConfig = config.gates.freshness;
  const hostErrorTracker = new HostErrorTracker(hostErrorBreakerConfig);

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

  const { data: queries = [] } = await dataApiClient.dataCollection.get({
    tickerId: input.tickerId,
  });

  report(...narrativeQueriesLoaded(subject, queries.length));

  log.info(
    { queryCount: queries.length },
    "loaded search queries from Agent Data API",
  );
  if (queries.length === 0) {
    log.warn(
      {},
      "no search queries returned for ticker; search and fetch stages will be empty",
    );
  }

  const now = new Date();
  const utcDayStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const utcDayEnd = new Date(utcDayStart.getTime() + 24 * 60 * 60 * 1000 - 1);
  const baselineToday = await dataApiClient.analysis.get({
    tickerId: input.tickerId,
    unanalyzed: false,
    start: utcDayStart.toISOString(),
    end: utcDayEnd.toISOString(),
    limit: 1,
  });
  const existingTodaySourceCount = baselineToday.dataSourceTotalCount;

  report(
    ...narrativeDailyQuota(
      subject,
      existingTodaySourceCount,
      targetDailySuccessfulSources,
    ),
  );

  let roundsExecuted = 0;
  let refillStopReason:
    | "daily_target_met_before_start"
    | "daily_target_met"
    | "max_rounds_reached"
    | "no_progress"
    | "no_queries"
    | null = null;
  let persistedThisRunCount = 0;
  let searchSuccessCount = 0;
  let searchFailedCount = 0;
  let searchEmptyCount = 0;
  let fetchSuccessCount = 0;
  let fetchedCount = 0;
  let fetchFailedCount = 0;
  const searchFailures: WebSearchFailure[] = [];
  const fetchFailures: Array<
    Awaited<ReturnType<typeof performWebFetch>>[number]["failures"][number]
  > = [];
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
  const droppedByFreshnessReason: Record<string, number> = {
    too_old: 0,
    future_dated: 0,
    unknown_date: 0,
  };
  let throttleEvents = 0;

  if (queries.length === 0) {
    report(
      "No search queries configured",
      `${subject.symbol} (${subject.name}) has no active search queries. Skipping collection.`,
      "completed",
    );
    refillStopReason = "no_queries";
  } else if (existingTodaySourceCount >= targetDailySuccessfulSources) {
    report(
      "Daily target already met",
      `${subject.symbol} already has ${existingTodaySourceCount} saved source${existingTodaySourceCount === 1 ? "" : "s"} today, meeting the target of ${targetDailySuccessfulSources}. Skipping collection.`,
      "completed",
    );
    refillStopReason = "daily_target_met_before_start";
  } else {
    report(...narrativeSearchRound(subject, queries.length, 1, maxTotalRounds));

    for (let round = 1; round <= maxTotalRounds; round += 1) {
      if (round > 1) {
        report(
          ...narrativeSearchRound(
            subject,
            queries.length,
            round,
            maxTotalRounds,
          ),
        );
      }
      roundsExecuted += 1;
      const searchThrottleStats = { throttleEvents: 0 };
      const searchAttemptResults = await performWebSearch(queries, {
        config: webSearchConfig,
        logger: log,
        throttleStats: searchThrottleStats,
      });
      throttleEvents += searchThrottleStats.throttleEvents;
      const roundSearchSuccesses = searchAttemptResults
        .filter((r) => r.success)
        .map((r) => r.data);
      const roundSearchEmpties = searchAttemptResults.filter(
        (r): r is WebSearchEmptyResult => !r.success && r.empty === true,
      );
      const roundSearchFailures = searchAttemptResults.filter(
        (r): r is WebSearchFailure => !r.success && !r.empty,
      );
      searchSuccessCount += roundSearchSuccesses.length;
      searchEmptyCount += roundSearchEmpties.length;
      searchFailedCount += roundSearchFailures.length;
      searchFailures.push(...roundSearchFailures);

      log.info(
        {
          round,
          searchHitCount: roundSearchSuccesses.length,
          searchEmpty: roundSearchEmpties.length,
          searchFailed: roundSearchFailures.length,
        },
        "web search stage finished",
      );

      const canonicalUniqueHits = new Map<
        string,
        (typeof roundSearchSuccesses)[number]
      >();
      for (const hit of roundSearchSuccesses) {
        const decision = classifyNoisyUrl(hit.url);
        if (decision.blocked) {
          droppedByUrlReason[decision.reason] += 1;
          continue;
        }

        if (canonicalUniqueHits.has(decision.canonicalUrl)) {
          droppedByDuplicateCanonicalUrl += 1;
          continue;
        }

        canonicalUniqueHits.set(decision.canonicalUrl, {
          ...hit,
          url: decision.canonicalUrl,
        });
      }

      const filteredSearchSuccesses = [...canonicalUniqueHits.values()];
      const candidateUrls = filteredSearchSuccesses.map((hit) => hit.url);
      const { existingUrls: existingUrlSet, hostCounts } =
        await resolveExistingDataSourceUrls(
          input.tickerId,
          candidateUrls,
          (body) => dataApiClient.dataCollectionExistingUrls.create(body),
        );
      const searchSuccessesForFetch = filteredSearchSuccesses.filter(
        (hit) => !existingUrlSet.has(hit.url),
      );
      const skippedExistingUrlCount =
        filteredSearchSuccesses.length - searchSuccessesForFetch.length;
      droppedByExistingCanonicalUrl += skippedExistingUrlCount;
      if (skippedExistingUrlCount > 0) {
        log.info(
          {
            round,
            skippedExistingUrlCount,
            searchHitCount: roundSearchSuccesses.length,
          },
          "skipped web fetch for URLs already stored as data sources",
        );
      }

      let searchSuccessesAfterDeadUrl = searchSuccessesForFetch;
      if (deadUrlCacheConfig.enabled) {
        const deadUrlSet = await resolveDeadUrls(
          input.tickerId,
          searchSuccessesForFetch.map((hit) => hit.url),
          (body) => dataApiClient.dataCollectionDeadUrlsLookup.create(body),
          deadUrlCacheConfig.skipLookupBatchSize,
        );
        if (deadUrlSet.size > 0) {
          const beforeCount = searchSuccessesAfterDeadUrl.length;
          searchSuccessesAfterDeadUrl = searchSuccessesAfterDeadUrl.filter(
            (hit) => !deadUrlSet.has(hit.url),
          );
          const skippedDeadUrlCount =
            beforeCount - searchSuccessesAfterDeadUrl.length;
          droppedByDeadUrlCache += skippedDeadUrlCount;
          log.info(
            {
              round,
              skippedDeadUrlCount,
              deadUrlLookupCount: deadUrlSet.size,
            },
            "skipped web fetch for URLs in dead-url negative cache",
          );
        }
      }

      const searchSuccessesAfterHostBreaker =
        searchSuccessesAfterDeadUrl.filter((hit) => {
          const host = hostFromUrl(hit.url);
          if (hostErrorTracker.isSkipped(host)) {
            droppedByHostErrorRate += 1;
            return false;
          }
          return true;
        });
      if (
        searchSuccessesAfterHostBreaker.length <
        searchSuccessesAfterDeadUrl.length
      ) {
        log.info(
          {
            round,
            skippedHostErrorRateCount:
              searchSuccessesAfterDeadUrl.length -
              searchSuccessesAfterHostBreaker.length,
          },
          "skipped web fetch for hosts over error-rate threshold",
        );
      }

      const roundDroppedBeforeFetch =
        roundSearchSuccesses.length - searchSuccessesAfterHostBreaker.length;
      report(
        ...narrativeFilteredResults(
          searchSuccessesAfterHostBreaker.length,
          roundDroppedBeforeFetch,
        ),
      );

      report(
        ...narrativeFetchStart(subject, searchSuccessesAfterHostBreaker.length),
      );

      let persistedThisRoundCount = 0;
      const roundQualityDrops: QualityDropForDeadUrl[] = [];

      // Persist a single fetched page as soon as its fetch resolves, so each
      // source reaches the Agent Data API immediately instead of waiting for the
      // whole round's fetch batch to finish. Invoked per URL from performWebFetch
      // via the onOutcome hook below.
      const persistFetchedPage = async (
        page: FetchedWebSearchResult,
      ): Promise<void> => {
        const urlDecision = classifyNoisyUrl(page.url);
        if (urlDecision.blocked) {
          droppedByUrlReason[urlDecision.reason] += 1;
          return;
        }

        const contentDecision = runQualityGate(
          page.title,
          page.content,
          page.url,
        );
        if (contentDecision.blocked) {
          droppedByContentQuality[contentDecision.reason] += 1;
          roundQualityDrops.push({
            url: urlDecision.canonicalUrl,
            reason: contentDecision.reason,
          });
          return;
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
                round,
                url: page.url.slice(0, 120),
                reason: relevanceDecision.reason,
              },
              "dropped page that did not mention the target ticker or industry",
            );
            return;
          }
        }

        const publishedAt = extractPublishedDate({
          fetchMetadata: page.fetchMetadata ?? page.jinaMetadata,
          content: page.content,
        });

        if (freshnessGateConfig.enabled) {
          const freshnessDecision = isFresh(publishedAt, {
            maxAgeDays: freshnessGateConfig.maxAgeDays,
            allowUnknown: freshnessGateConfig.allowUnknown,
          });
          if (!freshnessDecision.fresh) {
            droppedByFreshnessReason[freshnessDecision.reason] =
              (droppedByFreshnessReason[freshnessDecision.reason] ?? 0) + 1;
            log.info(
              {
                round,
                url: urlDecision.canonicalUrl.slice(0, 120),
                publishedAt: publishedAt?.toISOString() ?? null,
                reason: freshnessDecision.reason,
              },
              "dropped page outside freshness window",
            );
            return;
          }
        }

        const source: DataCollectionInput = {
          url: urlDecision.canonicalUrl,
          title: page.title,
          content: page.content,
          tickerId: input.tickerId,
          searchQueryId: page.searchQueryId,
          ...(publishedAt ? { publishedAt: publishedAt.toISOString() } : {}),
        };
        log.info(
          { round, url: urlDecision.canonicalUrl.slice(0, 120) },
          "persisting collected source to Agent Data API",
        );
        await dataApiClient.dataCollection.create([source]);
        persistedThisRunCount += 1;
        persistedThisRoundCount += 1;
        fetchSuccessCount += 1;
      };

      report(
        ...narrativeSavingSources(
          subject,
          searchSuccessesAfterHostBreaker.length,
        ),
      );

      const fetchThrottleStats = { throttleEvents: 0 };
      const fetchAttemptResults = await performWebFetch(
        searchSuccessesAfterHostBreaker,
        {
          config: webFetchConfig,
          logger: log,
          throttleStats: fetchThrottleStats,
          hostErrorTracker,
          onOutcome: async (outcome) => {
            if (outcome.success !== null) {
              await persistFetchedPage(outcome.success);
            }
          },
        },
      );
      throttleEvents += fetchThrottleStats.throttleEvents;
      const roundFetchSuccesses = fetchAttemptResults
        .filter((outcome) => outcome.success !== null)
        .map((outcome) => outcome.success!);
      const roundFetchFailures = fetchAttemptResults.flatMap(
        (outcome) => outcome.failures,
      );
      const roundFailedUrlCount = fetchAttemptResults.filter(
        (outcome) => outcome.success === null,
      ).length;
      fetchedCount += roundFetchSuccesses.length;
      fetchFailedCount += roundFailedUrlCount;
      fetchFailures.push(...roundFetchFailures);

      log.info(
        {
          round,
          fetchSuccess: persistedThisRoundCount,
          fetchFailed: roundFailedUrlCount,
          droppedByUrlReason,
          droppedByDuplicateCanonicalUrl,
          droppedByExistingCanonicalUrl,
          droppedByContentQuality,
          droppedByRelevance,
          droppedByDeadUrlCache,
          droppedByHostErrorRate,
          droppedByFreshnessReason,
          throttleEvents,
        },
        "web fetch stage finished",
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
            await dataApiClient.dataCollectionDeadUrlsRecord.create(
              deadUrlRecords,
            );
            log.info(
              { round, deadUrlRecordCount: deadUrlRecords.length },
              "recorded dead URLs to negative cache",
            );
          } catch (recordError) {
            log.warn(
              {
                round,
                deadUrlRecordCount: deadUrlRecords.length,
                err: recordError,
              },
              "failed to record dead URLs; continuing without negative cache write",
            );
          }
        }
      }

      const effectiveTodayCount =
        existingTodaySourceCount + persistedThisRunCount;
      if (effectiveTodayCount >= targetDailySuccessfulSources) {
        refillStopReason = "daily_target_met";
        break;
      }
      if (persistedThisRoundCount === 0) {
        refillStopReason = "no_progress";
        break;
      }
      if (round === maxTotalRounds) {
        refillStopReason = "max_rounds_reached";
      }
    }
  }

  const failuresPayload = [
    ...searchFailures.map((f) => ({
      id: crypto.randomUUID(),
      runId,
      tickerId: input.tickerId,
      stage: "web-search" as const,
      provider: "serper" as const,
      searchQueryId: f.queryId,
      errorCategory: f.errorCategory,
      retryable: f.retryable,
      message: f.message,
      httpStatus: f.httpStatus,
      createdAt: new Date().toISOString(),
    })),
    ...fetchFailures.map((f) => ({
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
    })),
  ];

  const totalSources = persistedThisRunCount;
  const status = deriveRunStatus({
    totalSources,
    failureCount: failuresPayload.length,
    runPolicy,
  });

  const droppedByUrlNoiseTotal = Object.values(droppedByUrlReason).reduce(
    (sum, count) => sum + count,
    0,
  );

  const droppedByFreshnessTotalCount = Object.values(
    droppedByFreshnessReason,
  ).reduce((sum, count) => sum + count, 0);

  const contentQualityDropped = Object.values(droppedByContentQuality).reduce(
    (sum, v) => sum + v,
    0,
  );

  const counters: RunCounters = {
    queriesTotal: queries.length,
    urlsTotal: searchSuccessCount,
    searchSuccess: searchSuccessCount,
    searchFailed: searchFailedCount,
    searchEmpty: searchEmptyCount,
    fetchSuccess: fetchSuccessCount,
    fetched: fetchedCount,
    fetchFailed: fetchFailedCount,
    retryCount: 0,
    droppedByRelevance,
    throttleEvents,
    agentId: "data-collection",
    persisted: persistedThisRunCount,
    droppedByDeadUrl: droppedByDeadUrlCache,
    droppedByHostErrorRate,
    droppedByFreshness: droppedByFreshnessTotalCount,
    droppedByFreshnessReason: { ...droppedByFreshnessReason },
    droppedByDuplicateCanonicalUrl,
    droppedByExistingCanonicalUrl,
    droppedByUrlNoise: droppedByUrlNoiseTotal,
    droppedByContentQuality: { ...droppedByContentQuality },
    roundsExecuted,
    stopReason: refillStopReason ?? undefined,
    durationMs: Date.now() - startedAt.getTime(),
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
      {
        failureRecords: failuresPayload.length,
        searchFailed: searchFailures.length,
        fetchFailed: fetchFailures.length,
      },
      "recording run failures to Agent Data API",
    );
    await dataApiClient.dataCollectionFailure.create(failuresPayload);
  }

  const summary = {
    totalSources,
    status,
    searchSuccess: searchSuccessCount,
    searchEmpty: searchEmptyCount,
    fetched: fetchedCount,
    fetchSuccess: fetchSuccessCount,
    droppedByRelevance,
    droppedByDeadUrlCache,
    droppedByHostErrorRate,
    droppedByFreshness: droppedByFreshnessTotalCount,
    droppedByFreshnessReason: { ...droppedByFreshnessReason },
    throttleEvents,
    refill: {
      roundsExecuted,
      maxTotalRounds,
      targetDailySuccessfulSources,
      existingTodaySourceCount,
      effectiveTodayCount: existingTodaySourceCount + persistedThisRunCount,
      stopReason: refillStopReason,
    },
  };

  const durationMs = Date.now() - startedAt.getTime();

  if (status === "failed") {
    const minRequired = runPolicy.minSuccessfulSources;
    const message =
      totalSources === 0
        ? `Data collection run failed: no sources were successfully collected, but the run policy requires at least ${minRequired} successful source${minRequired === 1 ? "" : "s"}.`
        : `Data collection run failed: only ${totalSources} successful source${totalSources === 1 ? "" : "s"} collected, but the run policy requires at least ${minRequired}.`;

    log.warn(
      {
        status,
        durationMs,
        totalSources,
        minRequired,
        failureCount: failuresPayload.length,
      },
      "data collection run completed with policy failure (semantic failure response)",
    );

    report(
      ...narrativeRunComplete(subject, {
        status,
        persisted: totalSources,
        droppedByRelevance,
        droppedByFreshness: droppedByFreshnessTotalCount,
        contentQualityDropped,
        failureCount: failuresPayload.length,
        stopReason: refillStopReason,
        roundsExecuted,
        targetDailySuccessfulSources,
      }),
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
      ? "data collection run completed with partial success"
      : "data collection run completed successfully";

  log.info(
    {
      status,
      durationMs,
      totalSources,
      failureCount: failuresPayload.length,
      droppedByRelevance,
      throttleEvents,
    },
    completionMessage,
  );

  report(
    ...narrativeRunComplete(subject, {
      status,
      persisted: totalSources,
      droppedByRelevance,
      droppedByFreshness: droppedByFreshnessTotalCount,
      contentQualityDropped,
      failureCount: failuresPayload.length,
      stopReason: refillStopReason,
      roundsExecuted,
      targetDailySuccessfulSources,
    }),
    "completed",
  );

  return {
    success: true,
    details: { summary },
  };
}
