import type { DataCollectionInput } from "@workspace/agent-types";
import { createAgentDataApiClient } from "@workspace/agent-data-api-client";
import type { AgentRunContext, AgentRunResult } from "@workspace/agent-runtime";
import { env } from "@mediapulse/env/agents-data-collection";
import { logger } from "@workspace/logger";
import crypto from "node:crypto";

import type { BodySchemaType } from "./utilities/body-schema";
import type { ConfigSchemaType } from "./utilities/config-schema";
import { performWebFetch } from "./utilities/web-fetch";
import { performWebSearch } from "./utilities/web-search";
import {
  createEmptyQualityCounters,
  runQualityGate,
} from "./utilities/content-quality-gate";
import { classifyNoisyUrl, type UrlNoiseReason } from "@workspace/utils";
import { resolveExistingDataSourceUrls } from "./utilities/resolve-existing-data-source-urls";
import { resolveDeadUrls } from "./utilities/resolve-dead-urls";
import { applyFetchBudget } from "./utilities/hit-ranker";
import {
  buildDeadUrlRecords,
  HostErrorTracker,
  hostFromUrl,
  type QualityDropForDeadUrl,
} from "./utilities/host-error-tracker";
import {
  buildTickerAliases,
  buildIndustryAliases,
  isRelevant,
} from "./utilities/ticker-relevance-gate";
import {
  deriveRunStatus,
  type RunCounters,
  type RunPolicy,
} from "./utilities/run-status";
import { extractPublishedDate } from "./utilities/date-extractor";
import { isFresh } from "./utilities/freshness-gate";
import { embedTexts } from "./utilities/embeddings";
import { dedupeAgainstCorpus } from "./utilities/semantic-dedupe";

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

  const runPolicy: RunPolicy = config.runPolicy ?? {
    minSuccessfulSources: 1,
    failOnZeroSuccess: true,
  };
  const targetDailySuccessfulSources = config.targetDailySuccessfulSources ?? 5;
  const maxRefillRounds = config.maxRefillRounds ?? 3;
  const maxTotalRounds = 1 + maxRefillRounds;

  const dataApiClient = createAgentDataApiClient({
    baseUrl: env.AGENT_DATA_API_URL,
    version: "v1",
    token,
  });

  const webSearchConfig = config.webSearch;
  const webFetchConfig = config.webFetch;
  const relevanceGateConfig = config.relevanceGate ?? {
    enabled: true,
    headChars: 1500,
    minMatches: 1,
  };
  const perQueryFetchBudget = config.perQueryFetchBudget ?? 3;
  const perRunFetchBudget = config.perRunFetchBudget ?? 40;
  const deadUrlCacheConfig = config.deadUrlCache ?? {
    enabled: true,
    skipLookupBatchSize: 50,
  };
  const hostErrorBreakerConfig = config.hostErrorBreaker ?? {
    enabled: true,
    minAttempts: 5,
    errorRateThreshold: 0.5,
  };
  const freshnessGateConfig = config.freshnessGate ?? {
    enabled: true,
    maxAgeDays: 14,
    allowUnknown: true,
  };
  const semanticDedupeConfig = config.semanticDedupe ?? {
    enabled: false,
    threshold: 0.88,
    windowDays: 7,
    embeddingModel: "text-embedding-3-small",
  };
  let semanticDedupeActive = semanticDedupeConfig.enabled;
  if (semanticDedupeActive && !config.openaiApiKey) {
    log.warn(
      {},
      "semantic dedupe enabled in config but openaiApiKey is missing; falling back to URL-only dedupe",
    );
    semanticDedupeActive = false;
  }
  const hostErrorTracker = new HostErrorTracker(hostErrorBreakerConfig);

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

  const { data: queries = [] } = await dataApiClient.dataCollection.get({
    tickerId: input.tickerId,
  });

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
  let fetchSuccessCount = 0;
  let fetchFailedCount = 0;
  const searchFailures: Array<
    Extract<
      Awaited<ReturnType<typeof performWebSearch>>[number],
      { success: false }
    >
  > = [];
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
  let droppedByPerQueryBudget = 0;
  let droppedByPerRunBudget = 0;
  let droppedByDeadUrlCache = 0;
  let droppedByHostErrorRate = 0;
  let droppedByFreshness = 0;
  let droppedBySemanticDedupe = 0;
  let throttleEvents = 0;

  if (queries.length === 0) {
    refillStopReason = "no_queries";
  } else if (existingTodaySourceCount >= targetDailySuccessfulSources) {
    refillStopReason = "daily_target_met_before_start";
  } else {
    for (let round = 1; round <= maxTotalRounds; round += 1) {
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
      const roundSearchFailures = searchAttemptResults.filter(
        (r) => !r.success,
      );
      searchSuccessCount += roundSearchSuccesses.length;
      searchFailedCount += roundSearchFailures.length;
      searchFailures.push(...roundSearchFailures);

      log.info(
        {
          round,
          searchHitCount: roundSearchSuccesses.length,
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

      const budgetSelection = applyFetchBudget(
        searchSuccessesAfterHostBreaker,
        {
          tickerAliases,
          hostCounts,
          perQueryFetchBudget,
          perRunFetchBudget,
        },
      );
      droppedByPerQueryBudget += budgetSelection.droppedByPerQueryBudget;
      droppedByPerRunBudget += budgetSelection.droppedByPerRunBudget;
      if (
        budgetSelection.droppedByPerQueryBudget > 0 ||
        budgetSelection.droppedByPerRunBudget > 0
      ) {
        log.info(
          {
            round,
            selectedForFetch: budgetSelection.hits.length,
            droppedByPerQueryBudget: budgetSelection.droppedByPerQueryBudget,
            droppedByPerRunBudget: budgetSelection.droppedByPerRunBudget,
            skippedByQuery: budgetSelection.skippedByQuery,
          },
          "applied pre-fetch ranking and fetch budgets",
        );
      }

      const fetchThrottleStats = { throttleEvents: 0 };
      const fetchAttemptResults = await performWebFetch(budgetSelection.hits, {
        config: webFetchConfig,
        logger: log,
        throttleStats: fetchThrottleStats,
        hostErrorTracker,
      });
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
      fetchFailedCount += roundFailedUrlCount;
      fetchFailures.push(...roundFetchFailures);

      const finalFetchSuccesses: typeof roundFetchSuccesses = [];
      const roundQualityDrops: QualityDropForDeadUrl[] = [];
      for (const page of roundFetchSuccesses) {
        const urlDecision = classifyNoisyUrl(page.url);
        if (urlDecision.blocked) {
          droppedByUrlReason[urlDecision.reason] += 1;
          continue;
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
                round,
                url: page.url.slice(0, 120),
                reason: relevanceDecision.reason,
              },
              "dropped page that did not mention the target ticker or industry",
            );
            continue;
          }
        }

        if (freshnessGateConfig.enabled) {
          const publishedAt = extractPublishedDate({
            fetchMetadata: page.fetchMetadata ?? page.jinaMetadata,
            content: page.content,
          });
          const freshnessDecision = isFresh(publishedAt, {
            maxAgeDays: freshnessGateConfig.maxAgeDays,
            allowUnknown: freshnessGateConfig.allowUnknown,
          });
          if (!freshnessDecision.fresh) {
            droppedByFreshness += 1;
            log.info(
              {
                round,
                url: urlDecision.canonicalUrl.slice(0, 120),
                publishedAt: publishedAt?.toISOString() ?? null,
                reason: freshnessDecision.reason,
              },
              "dropped page outside freshness window",
            );
            continue;
          }
        }

        finalFetchSuccesses.push({
          ...page,
          url: urlDecision.canonicalUrl,
        });
      }
      fetchSuccessCount += finalFetchSuccesses.length;

      log.info(
        {
          round,
          fetchSuccess: finalFetchSuccesses.length,
          fetchFailed: roundFailedUrlCount,
          droppedByUrlReason,
          droppedByDuplicateCanonicalUrl,
          droppedByExistingCanonicalUrl,
          droppedByContentQuality,
          droppedByRelevance,
          droppedByPerQueryBudget,
          droppedByPerRunBudget,
          droppedByDeadUrlCache,
          droppedByHostErrorRate,
          droppedByFreshness,
          droppedBySemanticDedupe,
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

      if (finalFetchSuccesses.length > 0) {
        let pagesToPersist = finalFetchSuccesses;

        if (semanticDedupeActive) {
          try {
            const { fingerprints } =
              await dataApiClient.dataCollectionRecentSourceFingerprints.get({
                tickerId: input.tickerId,
                windowDays: semanticDedupeConfig.windowDays,
              });
            const dedupeResult = await dedupeAgainstCorpus(
              pagesToPersist,
              fingerprints,
              {
                threshold: semanticDedupeConfig.threshold,
                embedder: (texts) =>
                  embedTexts(texts, {
                    apiKey: config.openaiApiKey!,
                    model: semanticDedupeConfig.embeddingModel,
                  }),
              },
            );
            droppedBySemanticDedupe += dedupeResult.dropped.length;
            for (const drop of dedupeResult.dropped) {
              log.info(
                {
                  round,
                  url: drop.candidate.url.slice(0, 120),
                  matchedExistingId: drop.matchedExistingId,
                  similarity: Number(drop.similarity.toFixed(3)),
                },
                "dropped semantically duplicate page against existing corpus",
              );
            }
            pagesToPersist = dedupeResult.kept;
          } catch (dedupeError) {
            log.warn(
              { round, err: dedupeError },
              "semantic dedupe failed; continuing with URL-only dedupe",
            );
          }
        }

        if (pagesToPersist.length > 0) {
          const sources: DataCollectionInput[] = pagesToPersist.map((page) => {
            const publishedAt = extractPublishedDate({
              fetchMetadata: page.fetchMetadata ?? page.jinaMetadata,
              content: page.content,
            });
            return {
              url: page.url,
              title: page.title,
              content: page.content,
              tickerId: input.tickerId,
              searchQueryId: page.searchQueryId,
              ...(publishedAt
                ? { publishedAt: publishedAt.toISOString() }
                : {}),
            };
          });
          log.info(
            { round, sourcesToPersist: sources.length },
            "persisting collected sources to Agent Data API",
          );
          await dataApiClient.dataCollection.create(sources);
          persistedThisRunCount += sources.length;
        } else {
          log.info({ round }, "no sources to persist after semantic dedupe");
        }
      } else {
        log.info({ round }, "no sources to persist after fetch stage");
      }

      const effectiveTodayCount =
        existingTodaySourceCount + persistedThisRunCount;
      if (effectiveTodayCount >= targetDailySuccessfulSources) {
        refillStopReason = "daily_target_met";
        break;
      }
      if (finalFetchSuccesses.length === 0) {
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

  const counters: RunCounters = {
    queriesTotal: queries.length,
    urlsTotal: searchSuccessCount,
    searchSuccess: searchSuccessCount,
    searchFailed: searchFailedCount,
    fetchSuccess: fetchSuccessCount,
    fetchFailed: fetchFailedCount,
    retryCount: 0,
    droppedByRelevance,
    throttleEvents,
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
    fetchSuccess: fetchSuccessCount,
    droppedByRelevance,
    droppedByPerQueryBudget,
    droppedByPerRunBudget,
    droppedByDeadUrlCache,
    droppedByHostErrorRate,
    droppedByFreshness,
    droppedBySemanticDedupe,
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
      droppedByPerQueryBudget,
      droppedByPerRunBudget,
      throttleEvents,
    },
    completionMessage,
  );

  return {
    success: true,
    details: { summary },
  };
}
