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
import { classifyNonArticleContent } from "./utilities/content-shape-filter";
import {
  classifyNoisyUrl,
  type UrlNoiseReason,
} from "./utilities/url-noise-filter";
import { resolveExistingDataSourceUrls } from "./utilities/resolve-existing-data-source-urls";
import {
  deriveRunStatus,
  type RunCounters,
  type RunPolicy,
} from "./utilities/run-status";

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
      timeWindow: input.timeWindow,
      runPolicy: config.runPolicy,
    },
    "data collection run started",
  );

  const runPolicy: RunPolicy = config.runPolicy ?? {
    minSuccessfulSources: 1,
    failOnZeroSuccess: true,
  };

  const dataApiClient = createAgentDataApiClient({
    baseUrl: env.AGENT_DATA_API_URL,
    version: "v1",
    token,
  });

  const webSearchConfig = config.webSearch;
  const webFetchConfig = config.webFetch;

  const query: { tickerId: string; start?: string; end?: string } = {
    tickerId: input.tickerId,
  };
  if (input.timeWindow) {
    query.start = input.timeWindow.start;
    query.end = input.timeWindow.end;
  }

  const { data: queries = [] } = await dataApiClient.dataCollection.get(query);

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

  const searchAttemptResults = await performWebSearch(queries, {
    config: webSearchConfig,
    logger: log,
  });
  const searchSuccesses = searchAttemptResults
    .filter((r) => r.success)
    .map((r) => r.data);
  const searchFailures = searchAttemptResults.filter((r) => !r.success);
  const droppedByUrlReason: Record<UrlNoiseReason, number> = {
    blocked_host: 0,
    blocked_host_path: 0,
    blocked_path: 0,
    blocked_extension: 0,
  };
  let droppedByDuplicateCanonicalUrl = 0;
  let droppedByExistingCanonicalUrl = 0;
  let droppedByContentShape = 0;

  log.info(
    {
      searchHitCount: searchSuccesses.length,
      searchFailed: searchFailures.length,
    },
    "web search stage finished",
  );

  const canonicalUniqueHits = new Map<
    string,
    (typeof searchSuccesses)[number]
  >();
  for (const hit of searchSuccesses) {
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
  const existingUrlSet = await resolveExistingDataSourceUrls(
    input.tickerId,
    candidateUrls,
    (body) => dataApiClient.dataCollectionExistingUrls.create(body),
  );
  const searchSuccessesForFetch = filteredSearchSuccesses.filter(
    (hit) => !existingUrlSet.has(hit.url),
  );
  droppedByExistingCanonicalUrl =
    filteredSearchSuccesses.length - searchSuccessesForFetch.length;
  const skippedExistingUrlCount = droppedByExistingCanonicalUrl;
  if (skippedExistingUrlCount > 0) {
    log.info(
      {
        skippedExistingUrlCount,
        searchHitCount: searchSuccesses.length,
      },
      "skipped web fetch for URLs already stored as data sources",
    );
  }

  const fetchAttemptResults = await performWebFetch(searchSuccessesForFetch, {
    config: webFetchConfig,
    logger: log,
  });
  const fetchSuccesses = fetchAttemptResults
    .filter((r) => r.success)
    .map((r) => r.data);
  const fetchFailures = fetchAttemptResults.filter((r) => !r.success);
  const finalFetchSuccesses: typeof fetchSuccesses = [];
  for (const page of fetchSuccesses) {
    const urlDecision = classifyNoisyUrl(page.url);
    if (urlDecision.blocked) {
      droppedByUrlReason[urlDecision.reason] += 1;
      continue;
    }

    const contentDecision = classifyNonArticleContent(page.title, page.content);
    if (contentDecision.blocked) {
      droppedByContentShape += 1;
      continue;
    }

    finalFetchSuccesses.push({
      ...page,
      url: urlDecision.canonicalUrl,
    });
  }

  log.info(
    {
      fetchSuccess: finalFetchSuccesses.length,
      fetchFailed: fetchFailures.length,
      droppedByUrlReason,
      droppedByDuplicateCanonicalUrl,
      droppedByExistingCanonicalUrl,
      droppedByContentShape,
    },
    "web fetch stage finished",
  );

  if (finalFetchSuccesses.length > 0) {
    const sources: DataCollectionInput[] = finalFetchSuccesses.map((page) => ({
      url: page.url,
      title: page.title,
      content: page.content,
      tickerId: input.tickerId,
      searchQueryId: page.searchQueryId,
    }));
    log.info(
      { sourcesToPersist: sources.length },
      "persisting collected sources to Agent Data API",
    );
    await dataApiClient.dataCollection.create(sources);
  } else {
    log.info({}, "no sources to persist after fetch stage");
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
      provider: "jina" as const,
      searchQueryId: f.queryId,
      url: f.url,
      errorCategory: f.errorCategory,
      retryable: f.retryable,
      message: f.message,
      httpStatus: f.httpStatus,
      createdAt: new Date().toISOString(),
    })),
  ];

  const totalSources = finalFetchSuccesses.length;
  const status = deriveRunStatus({
    totalSources,
    failureCount: failuresPayload.length,
    runPolicy,
  });

  const counters: RunCounters = {
    queriesTotal: queries.length,
    urlsTotal: filteredSearchSuccesses.length,
    searchSuccess: filteredSearchSuccesses.length,
    searchFailed: searchFailures.length,
    fetchSuccess: finalFetchSuccesses.length,
    fetchFailed: fetchFailures.length,
    retryCount: 0,
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
    searchSuccess: searchSuccesses.length,
    fetchSuccess: fetchSuccesses.length,
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

  log.info(
    {
      status,
      durationMs,
      totalSources,
      failureCount: failuresPayload.length,
    },
    "data collection run completed successfully",
  );

  return {
    success: true,
    details: { summary },
  };
}
