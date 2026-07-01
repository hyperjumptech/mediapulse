import type { DataCollectionInput } from "@workspace/agent-types";
import { createAgentDataApiClient } from "@workspace/agent-data-api-client";
import {
  createTokenUsageAccumulator,
  type AgentRunContext,
  type AgentRunResult,
} from "@workspace/agent-runtime";
import { env } from "@mediapulse/env/agents-data-collection";
import { logger } from "@workspace/logger";
import crypto from "node:crypto";

import type { BodySchemaType } from "./utilities/body-schema";
import type { ConfigSchemaType } from "./utilities/config-schema";
import {
  narrativeRunStart,
  narrativeSearching,
  narrativeFetching,
  narrativeRunComplete,
} from "./utilities/build-activity-narrative";
import {
  performWebFetch,
  createEmptyQualityCounters,
  resolveExistingDataSourceUrls,
  resolveDeadUrls,
  buildDeadUrlRecords,
  HostErrorTracker,
  hostFromUrl,
  type QualityDropForDeadUrl,
  type FetchedWebSearchResult,
  buildTickerAliases,
  buildIndustryAliases,
  deriveRunStatus,
  type RunCounters,
  type RunPolicy,
  makeDroppedOutcome,
  makeCollectedOutcome,
  makeFailedOutcome,
  postOutcomesInChunks,
  type CollectionUrlOutcomeInput,
} from "@workspace/agent-ingestion";
import {
  performWebSearch,
  type WebSearchEmptyResult,
  type WebSearchFailure,
} from "./utilities/web-search";
import { RoundRobinCursor } from "./utilities/provider-dispatch";
import { buildFetchProviderConfigs } from "./utilities/fetch-provider-config";
import {
  checkContent,
  checkFreshness,
  judgeRelevance,
} from "./utilities/filter";
import {
  classifyNoisyUrl,
  derivePublisherFromUrl,
  sleep,
  type UrlNoiseReason,
} from "@workspace/utils";
import { computeStartupJitterMs } from "./utilities/startup-jitter";

/** Run success criteria, formerly the configurable runPolicy section. */
const RUN_POLICY: RunPolicy = {
  minSuccessfulSources: 1,
  failOnZeroSuccess: false,
};

/** Dead-URL negative-cache lookup batch size. */
const DEAD_URL_LOOKUP_BATCH_SIZE = 50;

/**
 * Hard wall-clock budget for a single data-collection run. Once exceeded, the round
 * loop stops and the in-flight fetch stage abandons remaining URLs, so one slow or
 * hostile host cannot wedge the run (and the pipeline behind it) for hours.
 */
const RUN_WALL_CLOCK_BUDGET_MS = 15 * 60 * 1000;

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
  const { input, config, token, hermesCorrelation, contract } = context;
  const contractBrief = contract?.brief;
  const startedAt = new Date();
  const runId = crypto.randomUUID();
  const scheduleExecutionId =
    hermesCorrelation?.scheduleExecutionId ?? undefined;
  // Chronicle instrumentation: accumulate relevance-filter LLM token usage across
  // every judged page in the run, and search-provider credits across every search.
  const relevanceUsage = createTokenUsageAccumulator();
  const searchCreditsSink = { credits: 0 };
  const outcomes: CollectionUrlOutcomeInput[] = [];

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
      runPolicy: RUN_POLICY,
      collection: config.collection,
    },
    "data collection run started",
  );

  // Random startup delay so concurrent ticker runs de-synchronize and don't burst the
  // shared fetch-provider (e.g. Serper) rate limit in the same instant.
  const startupJitterMs = computeStartupJitterMs(
    config.collection.startupJitterMs,
  );
  if (startupJitterMs > 0) {
    log.info(
      { startupJitterMs },
      "data collection run: applying startup jitter",
    );
    await sleep(startupJitterMs);
  }

  const runPolicy = RUN_POLICY;
  const targetSavedSources = config.collection.targetSavedSources;
  const maxTotalRounds = config.collection.maxRounds;
  const searchCursor = new RoundRobinCursor();

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
  const peerNames = tickerRecord.peers.map((peer) => peer.symbol);
  const subject = { symbol: tickerRecord.symbol, name: tickerRecord.name };

  report(...narrativeRunStart(subject));

  const fetchProviderConfigs = buildFetchProviderConfigs(config.web_fetch);
  const hostErrorTracker = new HostErrorTracker({
    enabled: true,
    minAttempts: 5,
    errorRateThreshold: 0.5,
  });

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
    | "wall_clock_exceeded"
    | null = null;
  const runDeadlineEpochMs = startedAt.getTime() + RUN_WALL_CLOCK_BUDGET_MS;
  let persistedThisRunCount = 0;
  let searchSuccessCount = 0;
  let searchFailedCount = 0;
  let searchEmptyCount = 0;
  let fetchSuccessCount = 0;
  let fetchedCount = 0;
  let fetchFailedCount = 0;
  // Chronicle instrumentation: per-provider fetch success counts across the run.
  const fetchByProvider: Record<string, number> = {};
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
    refillStopReason = "no_queries";
  } else if (existingTodaySourceCount >= targetSavedSources) {
    refillStopReason = "daily_target_met_before_start";
  } else {
    report(...narrativeSearching(subject, queries.length));

    for (let round = 1; round <= maxTotalRounds; round += 1) {
      if (Date.now() >= runDeadlineEpochMs) {
        refillStopReason = "wall_clock_exceeded";
        log.warn(
          { round, budgetMs: RUN_WALL_CLOCK_BUDGET_MS },
          "run wall-clock budget exceeded; stopping before next round",
        );
        break;
      }
      roundsExecuted += 1;
      const searchAttemptResults = await performWebSearch(queries, {
        config: config.web_search,
        locales: config.web_search_locales,
        page: round - 1,
        cursor: searchCursor,
        logger: log,
        creditsSink: searchCreditsSink,
      });
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
          outcomes.push(
            makeDroppedOutcome(
              {
                id: crypto.randomUUID(),
                scheduleExecutionId,
                runId,
                tickerId: input.tickerId,
                agent: "data-collection",
                url: hit.url,
                source: hit.searchQueryText,
                searchQueryId: hit.searchQueryId,
                createdAt: new Date().toISOString(),
              },
              { reason: `url_noise_${decision.reason}`, detail: hit.url },
            ),
          );
          continue;
        }

        if (canonicalUniqueHits.has(decision.canonicalUrl)) {
          droppedByDuplicateCanonicalUrl += 1;
          outcomes.push(
            makeDroppedOutcome(
              {
                id: crypto.randomUUID(),
                scheduleExecutionId,
                runId,
                tickerId: input.tickerId,
                agent: "data-collection",
                url: decision.canonicalUrl,
                source: hit.searchQueryText,
                searchQueryId: hit.searchQueryId,
                createdAt: new Date().toISOString(),
              },
              { reason: "duplicate_canonical_url" },
            ),
          );
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
      const searchSuccessesForFetch = filteredSearchSuccesses.filter((hit) => {
        if (existingUrlSet.has(hit.url)) {
          outcomes.push(
            makeDroppedOutcome(
              {
                id: crypto.randomUUID(),
                scheduleExecutionId,
                runId,
                tickerId: input.tickerId,
                agent: "data-collection",
                url: hit.url,
                source: hit.searchQueryText,
                searchQueryId: hit.searchQueryId,
                createdAt: new Date().toISOString(),
              },
              { reason: "existing_canonical_url" },
            ),
          );
          return false;
        }
        return true;
      });
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
      {
        const deadUrlSet = await resolveDeadUrls(
          input.tickerId,
          searchSuccessesForFetch.map((hit) => hit.url),
          (body) => dataApiClient.dataCollectionDeadUrlsLookup.create(body),
          DEAD_URL_LOOKUP_BATCH_SIZE,
        );
        if (deadUrlSet.size > 0) {
          const beforeDeadUrlCount = searchSuccessesAfterDeadUrl.length;
          searchSuccessesAfterDeadUrl = searchSuccessesAfterDeadUrl.filter(
            (hit) => {
              if (deadUrlSet.has(hit.url)) {
                outcomes.push(
                  makeDroppedOutcome(
                    {
                      id: crypto.randomUUID(),
                      scheduleExecutionId,
                      runId,
                      tickerId: input.tickerId,
                      agent: "data-collection",
                      url: hit.url,
                      source: hit.searchQueryText,
                      searchQueryId: hit.searchQueryId,
                      createdAt: new Date().toISOString(),
                    },
                    { reason: "dead_url_cache" },
                  ),
                );
                return false;
              }
              return true;
            },
          );
          const skippedDeadUrlCount =
            beforeDeadUrlCount - searchSuccessesAfterDeadUrl.length;
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
            outcomes.push(
              makeDroppedOutcome(
                {
                  id: crypto.randomUUID(),
                  scheduleExecutionId,
                  runId,
                  tickerId: input.tickerId,
                  agent: "data-collection",
                  url: hit.url,
                  source: hit.searchQueryText,
                  searchQueryId: hit.searchQueryId,
                  createdAt: new Date().toISOString(),
                },
                { reason: "host_error_rate", host },
              ),
            );
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

      if (round === 1) {
        report(...narrativeFetching(subject));
      }

      let persistedThisRoundCount = 0;
      const roundQualityDrops: QualityDropForDeadUrl[] = [];

      // Persist a single fetched page as soon as its fetch resolves, so each
      // source reaches the Agent Data API immediately instead of waiting for the
      // whole round's fetch batch to finish. Invoked per URL from performWebFetch
      // via the onOutcome hook below.
      const persistFetchedPage = async (
        page: FetchedWebSearchResult,
      ): Promise<void> => {
        const outcomeBase = {
          id: crypto.randomUUID(),
          scheduleExecutionId,
          runId,
          tickerId: input.tickerId,
          agent: "data-collection" as const,
          url: page.url,
          source: page.searchQueryText,
          searchQueryId: page.searchQueryId,
          createdAt: new Date().toISOString(),
        };

        const urlDecision = classifyNoisyUrl(page.url);
        if (urlDecision.blocked) {
          droppedByUrlReason[urlDecision.reason] += 1;
          outcomes.push(
            makeDroppedOutcome(outcomeBase, {
              reason: `url_noise_${urlDecision.reason}`,
              detail: page.url,
            }),
          );
          return;
        }

        const contentDecision = checkContent(
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
          outcomes.push(
            makeDroppedOutcome(
              { ...outcomeBase, url: urlDecision.canonicalUrl },
              contentDecision.reason === "content_too_short"
                ? {
                    reason: contentDecision.reason,
                    charCount: page.content.length,
                  }
                : { reason: contentDecision.reason },
            ),
          );
          return;
        }

        const relevanceDecision = await judgeRelevance({
          title: page.title,
          content: page.content,
          tickerSymbol: subject.symbol,
          tickerName: subject.name,
          tickerAliases,
          industryAliases,
          businessActivity: tickerRecord.businessActivity,
          subIndustry: tickerRecord.subIndustry,
          peerNames,
          contractBrief,
          llm: config.relevance,
          logger: log,
          onUsage: relevanceUsage.onUsage,
        });
        if (!relevanceDecision.keep) {
          droppedByRelevance += 1;
          outcomes.push(
            makeDroppedOutcome(
              { ...outcomeBase, url: urlDecision.canonicalUrl },
              {
                reason: "relevance_no_match",
                tickerSymbol: subject.symbol,
                headChars: 6000,
              },
            ),
          );
          log.info(
            {
              round,
              url: page.url.slice(0, 120),
              via: relevanceDecision.via,
            },
            "dropped page judged not relevant to the target ticker or industry",
          );
          return;
        }

        const { decision: freshnessDecision, publishedAt } = checkFreshness({
          fetchMetadata: page.fetchMetadata ?? page.jinaMetadata,
          content: page.content,
        });

        if (!freshnessDecision.fresh) {
          droppedByFreshnessReason[freshnessDecision.reason] =
            (droppedByFreshnessReason[freshnessDecision.reason] ?? 0) + 1;
          const freshnessContext =
            freshnessDecision.reason === "too_old" && publishedAt
              ? {
                  reason: "freshness_too_old" as const,
                  publishedAt,
                  maxAgeDays: 7,
                }
              : freshnessDecision.reason === "future_dated" && publishedAt
                ? { reason: "freshness_future_dated" as const, publishedAt }
                : { reason: "freshness_unknown_date" as const };
          outcomes.push(
            makeDroppedOutcome(
              { ...outcomeBase, url: urlDecision.canonicalUrl },
              freshnessContext,
            ),
          );
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

        const resolvedSource =
          page.source ?? derivePublisherFromUrl(urlDecision.canonicalUrl);
        const collectedSource: DataCollectionInput = {
          url: urlDecision.canonicalUrl,
          title: page.title,
          content: page.content,
          tickerId: input.tickerId,
          searchQueryId: page.searchQueryId,
          ...(page.author ? { author: page.author } : {}),
          ...(resolvedSource ? { source: resolvedSource } : {}),
          ...(publishedAt ? { publishedAt: publishedAt.toISOString() } : {}),
        };
        log.info(
          { round, url: urlDecision.canonicalUrl.slice(0, 120) },
          "persisting collected source to Agent Data API",
        );
        await dataApiClient.dataCollection.create([collectedSource]);
        outcomes.push(
          makeCollectedOutcome({
            ...outcomeBase,
            url: urlDecision.canonicalUrl,
          }),
        );
        persistedThisRunCount += 1;
        persistedThisRoundCount += 1;
        fetchSuccessCount += 1;
      };

      const fetchThrottleStats = { throttleEvents: 0 };
      const fetchAttemptResults = await performWebFetch(
        searchSuccessesAfterHostBreaker,
        {
          config: { providers: fetchProviderConfigs },
          logger: log,
          throttleStats: fetchThrottleStats,
          hostErrorTracker,
          deadlineEpochMs: runDeadlineEpochMs,
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
      for (const success of roundFetchSuccesses) {
        fetchByProvider[success.provider] =
          (fetchByProvider[success.provider] ?? 0) + 1;
      }

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

      {
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
      if (effectiveTodayCount >= targetSavedSources) {
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
      provider: f.provider,
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
    // Chronicle instrumentation: durable provider + relevance-LLM token record.
    searchProvider: [...new Set(config.web_search.map((p) => p.provider))].join(
      ", ",
    ),
    searchCredits: searchCreditsSink.credits,
    ...(Object.keys(fetchByProvider).length > 0 ? { fetchByProvider } : {}),
    relevanceModel: config.relevance.model,
    relevancePromptTokens: relevanceUsage.totals().promptTokens,
    relevanceCompletionTokens: relevanceUsage.totals().completionTokens,
    relevanceTotalTokens: relevanceUsage.totals().totalTokens,
  };

  const runPayload = {
    id: runId,
    tickerId: input.tickerId,
    scheduleExecutionId,
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

  for (const failure of fetchFailures) {
    if (failure.url) {
      outcomes.push(
        makeFailedOutcome(
          {
            id: crypto.randomUUID(),
            scheduleExecutionId,
            runId,
            tickerId: input.tickerId,
            agent: "data-collection",
            url: failure.url,
            source: undefined,
            searchQueryId: failure.queryId,
            createdAt: new Date().toISOString(),
          },
          failure.errorCategory,
          failure.httpStatus,
        ),
      );
    }
  }

  if (outcomes.length > 0) {
    try {
      await postOutcomesInChunks(outcomes, (batch) =>
        dataApiClient.collectionUrlOutcome.create(batch),
      );
      log.info(
        { outcomeCount: outcomes.length },
        "posted per-URL collection outcomes",
      );
    } catch (outcomeError) {
      log.warn(
        { err: outcomeError },
        "failed to post collection URL outcomes; continuing",
      );
    }
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
      targetSavedSources,
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
        targetSavedSources,
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
      targetSavedSources,
    }),
    "completed",
  );

  return {
    success: true,
    details: { summary },
  };
}
