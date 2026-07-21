import type { DataCollectionInput } from "@workspace/agent-types";
import { createAgentDataApiClient } from "@workspace/agent-data-api-client";
import type { AgentRunContext, AgentRunResult } from "@workspace/agent-runtime";
import { env } from "@mediapulse/env/agents-data-collection";
import { logger } from "@workspace/logger";
import crypto from "node:crypto";

import {
  DATA_COLLECTION_AGENT_ID,
  DATA_COLLECTION_AGENT_VERSION,
} from "./constants";
import type { BodySchemaType } from "./utilities/body-schema";
import type { ConfigSchemaType } from "./utilities/config-schema";
import {
  narrativeRunStart,
  narrativeSearching,
  narrativeFetching,
  narrativeRunComplete,
} from "./utilities/build-activity-narrative";
import {
  isFresh,
  extractDateFromUrl,
  resolveExistingDataSourceUrls,
  resolveDeadUrls,
  deriveRunStatus,
  type RunPolicy,
  makeDroppedOutcome,
  makeCollectedOutcome,
  postOutcomesInChunks,
  type CollectionUrlOutcomeInput,
  createTickerRelevanceMatcher,
  buildRelevanceMatchText,
  isJunkTitle,
  hasSufficientDescription,
  createTitleDeduper,
  MIN_DESCRIPTION_CHARS,
} from "@workspace/agent-ingestion";
import {
  performWebSearch,
  type WebSearchEmptyResult,
  type WebSearchFailure,
  type WebSearchResult,
} from "./utilities/web-search";
import { RoundRobinCursor } from "@workspace/agent-search";
import {
  classifyNoisyUrl,
  derivePublisherFromUrl,
  sleep,
  type UrlNoiseReason,
} from "@workspace/utils";
import { computeStartupJitterMs } from "./utilities/startup-jitter";

/** Freshness window in days. Sources older than this are dropped. */
const FRESHNESS_MAX_AGE_DAYS = 7;

/** Run success criteria, formerly the configurable runPolicy section. */
const RUN_POLICY: RunPolicy = {
  minSuccessfulSources: 1,
  failOnZeroSuccess: false,
};

/** Dead-URL negative-cache lookup batch size. */
const DEAD_URL_LOOKUP_BATCH_SIZE = 50;

/**
 * Hard wall-clock budget for a single data-collection run. Once exceeded, the round
 * loop stops before the next round, so one slow or hostile host cannot wedge the run
 * (and the pipeline behind it) for hours.
 */
const RUN_WALL_CLOCK_BUDGET_MS = 15 * 60 * 1000;

/**
 * Executes the data-collection pipeline: load search queries, run web search,
 * persist surviving hits as Data Source descriptions with no paid fetch, record
 * failures, and record run metadata.
 *
 * @param context - Validated `input` and `config`, plus the bearer `token` for the Agent Data API.
 * @returns Success with summary counts.
 */
export async function runDataCollection(
  context: AgentRunContext<BodySchemaType, ConfigSchemaType>,
): Promise<AgentRunResult> {
  const { input, config, token, hermesCorrelation } = context;
  const startedAt = new Date();
  const runId = crypto.randomUUID();
  const scheduleExecutionId =
    hermesCorrelation?.scheduleExecutionId ?? undefined;
  const searchCreditsSink = {
    credits: 0,
    byProvider: {} as Record<string, number>,
  };
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
  const subject = { symbol: tickerRecord.symbol, name: tickerRecord.name };

  report(...narrativeRunStart(subject));

  // Deterministic relevance gate, scoped to this run's ticker. Fails closed: with
  // no terms there is nothing to match against, so the run stops rather than
  // persisting unfiltered hits or blaming them for an infrastructure failure.
  const { tickers: relevanceTickers } =
    await dataApiClient.tickerRelevanceTerms.get({});
  const relevanceMatcher = createTickerRelevanceMatcher(
    relevanceTickers.filter((ticker) => ticker.id === input.tickerId),
  );
  if (relevanceMatcher.isEmpty) {
    throw new Error(
      `No relevance terms for ticker ${tickerRecord.symbol}; refusing to collect unfiltered hits.`,
    );
  }
  const titleDeduper = createTitleDeduper();

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
  let searchEmptyCount = 0;
  const searchFailures: WebSearchFailure[] = [];
  const droppedByUrlReason: Record<UrlNoiseReason, number> = {
    blocked_host: 0,
    low_value_source: 0,
    blocked_host_path: 0,
    blocked_path: 0,
    blocked_extension: 0,
    site_homepage: 0,
    non_article_page: 0,
  };
  let droppedByDuplicateCanonicalUrl = 0;
  let droppedByExistingCanonicalUrl = 0;
  let droppedByEmptyDescription = 0;
  let droppedByShortDescription = 0;
  let droppedByJunkTitle = 0;
  let droppedByDuplicateTitle = 0;
  let droppedByRelevance = 0;
  let droppedByDeadUrlCache = 0;
  const droppedByFreshnessReason: Record<string, number> = {
    too_old: 0,
    future_dated: 0,
    unknown_date: 0,
  };

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
      const { existingUrls: existingUrlSet } =
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

      if (round === 1) {
        report(...narrativeFetching(subject));
      }

      let persistedThisRoundCount = 0;

      // Persist each surviving search hit directly, with no paid fetch. The hit's
      // snippet becomes the Data Source description; the full body is fetched later,
      // on demand, in content-generation (ADR-0001).
      const persistHit = async (hit: WebSearchResult): Promise<void> => {
        const urlDecision = classifyNoisyUrl(hit.url);
        const canonicalUrl = urlDecision.blocked
          ? hit.url
          : urlDecision.canonicalUrl;
        const outcomeBase = {
          id: crypto.randomUUID(),
          scheduleExecutionId,
          runId,
          tickerId: input.tickerId,
          agent: "data-collection" as const,
          url: canonicalUrl,
          source: hit.searchQueryText,
          searchQueryId: hit.searchQueryId,
          createdAt: new Date().toISOString(),
        };

        if (isJunkTitle(hit.title)) {
          droppedByJunkTitle += 1;
          outcomes.push(
            makeDroppedOutcome(outcomeBase, {
              reason: "junk_title",
              title: hit.title,
            }),
          );
          return;
        }

        if (titleDeduper.isDuplicate(hit.title)) {
          droppedByDuplicateTitle += 1;
          outcomes.push(
            makeDroppedOutcome(outcomeBase, {
              reason: "duplicate_title",
              title: hit.title,
            }),
          );
          return;
        }

        const description = hit.content.trim();
        if (description === "") {
          droppedByEmptyDescription += 1;
          outcomes.push(
            makeDroppedOutcome(outcomeBase, { reason: "empty_description" }),
          );
          return;
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
          return;
        }

        const relevanceText = buildRelevanceMatchText(hit.title, description);
        if (!relevanceMatcher.match(relevanceText)) {
          droppedByRelevance += 1;
          outcomes.push(
            makeDroppedOutcome(outcomeBase, {
              reason: "relevance_no_match",
              tickerSymbol: tickerRecord.symbol,
              matchTextChars: relevanceText.length,
            }),
          );
          return;
        }

        const parsedPublishedAt = hit.publishedAt
          ? new Date(hit.publishedAt)
          : null;
        const publishedAt =
          parsedPublishedAt && !isNaN(parsedPublishedAt.getTime())
            ? parsedPublishedAt
            : extractDateFromUrl(canonicalUrl);
        const freshnessDecision = isFresh(publishedAt, {
          maxAgeDays: FRESHNESS_MAX_AGE_DAYS,
          allowUnknown: true,
        });

        if (!freshnessDecision.fresh) {
          droppedByFreshnessReason[freshnessDecision.reason] =
            (droppedByFreshnessReason[freshnessDecision.reason] ?? 0) + 1;
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
          log.info(
            {
              round,
              url: canonicalUrl.slice(0, 120),
              publishedAt: publishedAt?.toISOString() ?? null,
              reason: freshnessDecision.reason,
            },
            "dropped hit outside freshness window",
          );
          return;
        }

        const resolvedSource = derivePublisherFromUrl(canonicalUrl);
        const collectedSource: DataCollectionInput = {
          url: canonicalUrl,
          title: hit.title,
          description,
          tickerId: input.tickerId,
          searchQueryId: hit.searchQueryId,
          dataCollectionRunId: runId,
          ...(resolvedSource ? { source: resolvedSource } : {}),
          ...(publishedAt ? { publishedAt: publishedAt.toISOString() } : {}),
        };
        log.info(
          { round, url: canonicalUrl.slice(0, 120) },
          "persisting collected source to Agent Data API",
        );
        await dataApiClient.dataCollection.create([collectedSource]);
        outcomes.push(makeCollectedOutcome(outcomeBase));
        persistedThisRunCount += 1;
        persistedThisRoundCount += 1;
      };

      for (const hit of searchSuccessesAfterDeadUrl) {
        await persistHit(hit);

        if (
          existingTodaySourceCount + persistedThisRunCount >=
          targetSavedSources
        ) {
          break;
        }
      }

      log.info(
        {
          round,
          persisted: persistedThisRoundCount,
          droppedByUrlReason,
          droppedByDuplicateCanonicalUrl,
          droppedByExistingCanonicalUrl,
          droppedByEmptyDescription,
          droppedByShortDescription,
          droppedByJunkTitle,
          droppedByDuplicateTitle,
          droppedByRelevance,
          droppedByDeadUrlCache,
          droppedByFreshnessReason,
        },
        "search-hit persist stage finished",
      );

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

  const runDurationMs = Date.now() - startedAt.getTime();

  const byReason: Record<string, number> = {
    existing: droppedByExistingCanonicalUrl,
    freshness: droppedByFreshnessTotalCount,
    duplicate: droppedByDuplicateCanonicalUrl,
    urlNoise: droppedByUrlNoiseTotal,
    emptyDescription: droppedByEmptyDescription,
    shortDescription: droppedByShortDescription,
    junkTitle: droppedByJunkTitle,
    duplicateTitle: droppedByDuplicateTitle,
    relevance: droppedByRelevance,
    deadUrl: droppedByDeadUrlCache,
  };

  const snapshot = {
    agentId: DATA_COLLECTION_AGENT_ID,
    agentVersion: DATA_COLLECTION_AGENT_VERSION,
    cost: {
      searchCredits: searchCreditsSink.credits,
      searchCreditsByProvider: searchCreditsSink.byProvider,
    },
    result: {
      saved: persistedThisRunCount,
      excluded: Object.values(byReason).reduce((sum, count) => sum + count, 0),
      byReason,
    },
    timing: {
      totalMs: runDurationMs,
      roundsExecuted,
      ...(refillStopReason ? { stopReason: refillStopReason } : {}),
    },
  };

  const runPayload = {
    id: runId,
    tickerId: input.tickerId,
    scheduleExecutionId,
    startedAt: startedAt.toISOString(),
    completedAt: new Date().toISOString(),
    status,
    snapshot,
  };

  await dataApiClient.dataCollectionRun.create(runPayload);

  if (failuresPayload.length > 0) {
    log.warn(
      {
        failureRecords: failuresPayload.length,
        searchFailed: searchFailures.length,
      },
      "recording run failures to Agent Data API",
    );
    await dataApiClient.dataCollectionFailure.create(failuresPayload);
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
    persisted: persistedThisRunCount,
    droppedByEmptyDescription,
    droppedByDeadUrlCache,
    droppedByFreshness: droppedByFreshnessTotalCount,
    droppedByFreshnessReason: { ...droppedByFreshnessReason },
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
    },
    completionMessage,
  );

  report(
    ...narrativeRunComplete(subject, {
      status,
      persisted: totalSources,
      droppedByFreshness: droppedByFreshnessTotalCount,
      droppedByRelevance,
      droppedByNonArticleUrl:
        droppedByUrlReason.site_homepage + droppedByUrlReason.non_article_page,
      droppedByThinDescription:
        droppedByEmptyDescription + droppedByShortDescription,
      droppedByDuplicate:
        droppedByDuplicateCanonicalUrl + droppedByDuplicateTitle,
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
