import type { DataCollectionInput } from "@workspace/agent-types";
import { createAgentDataApiClient } from "@workspace/agent-data-api-client";
import type { AgentRunContext, AgentRunResult } from "@workspace/agent-runtime";
import { env } from "@mediapulse/env/agents-data-collection";
import crypto from "node:crypto";

import type { BodySchemaType } from "./utilities/body-schema";
import type { ConfigSchemaType } from "./utilities/config-schema";
import { performWebFetch } from "./utilities/web-fetch";
import { performWebSearch } from "./utilities/web-search";
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
 *   (Hermes maps this to HTTP 200 + envelope so pipeline execution shows the message; do not throw for this case).
 */
export async function runDataCollection(
  context: AgentRunContext<BodySchemaType, ConfigSchemaType>,
): Promise<AgentRunResult> {
  const { input, config, token } = context;
  const startedAt = new Date();
  const runId = crypto.randomUUID();

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

  const searchAttemptResults = await performWebSearch(queries, {
    config: webSearchConfig,
  });
  const searchSuccesses = searchAttemptResults
    .filter((r) => r.success)
    .map((r) => r.data);
  const searchFailures = searchAttemptResults.filter((r) => !r.success);

  const fetchAttemptResults = await performWebFetch(searchSuccesses, {
    config: webFetchConfig,
  });
  const fetchSuccesses = fetchAttemptResults
    .filter((r) => r.success)
    .map((r) => r.data);
  const fetchFailures = fetchAttemptResults.filter((r) => !r.success);

  if (fetchSuccesses.length > 0) {
    const sources: DataCollectionInput[] = fetchSuccesses.map((page) => ({
      url: page.url,
      title: page.title,
      content: page.content,
      tickerId: input.tickerId,
      searchQueryId: page.searchQueryId,
    }));
    await dataApiClient.dataCollection.create(sources);
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

  const totalSources = fetchSuccesses.length;
  const status = deriveRunStatus({
    totalSources,
    failureCount: failuresPayload.length,
    runPolicy,
  });

  const counters: RunCounters = {
    queriesTotal: queries.length,
    urlsTotal: searchSuccesses.length,
    searchSuccess: searchSuccesses.length,
    searchFailed: searchFailures.length,
    fetchSuccess: fetchSuccesses.length,
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
    await dataApiClient.dataCollectionFailure.create(failuresPayload);
  }

  const summary = {
    totalSources,
    status,
    searchSuccess: searchSuccesses.length,
    fetchSuccess: fetchSuccesses.length,
  };

  if (status === "failed") {
    return {
      success: false,
      message:
        "Data collection run failed due to validation or zero successes.",
      details: { summary },
    };
  }

  return {
    success: true,
    details: { summary },
  };
}
