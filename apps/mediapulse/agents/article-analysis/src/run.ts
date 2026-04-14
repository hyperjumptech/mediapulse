import { createAgentDataApiClient } from "@workspace/agent-data-api-client";
import type { AgentRunContext, AgentRunResult } from "@workspace/agent-runtime";
import { env } from "@mediapulse/env/agents-article-analysis";
import { logger } from "@workspace/logger";

import type { Config, Input } from "./index.js";
import {
  applyMaxBatchSizeCap,
  buildAnalysisGetQuery,
  sortAnalysisDataSourcesByCreatedAt,
} from "./run-helpers.js";

/**
 * Loads analysis context for the ticker (incremental or reanalyze), applies optional time window via GET,
 * and deterministically caps the in-memory batch when `maxBatchSize` is set.
 *
 * @param context - Validated input, optional config, and bearer token for agent-data-api.
 * @returns Success with backlog / batch summary, or failure when the data API call fails.
 */
export const run = async ({
  input,
  config,
  token,
}: AgentRunContext<Input, Config>): Promise<AgentRunResult> => {
  /** Hermes applies input-schema defaults; direct `run` callers (tests) may omit optional fields. */
  const reanalyze = input.reanalyze ?? false;
  const inputForQuery = { ...input, reanalyze };

  if (config.verbose) {
    logger.info({ tickerId: input.tickerId }, "article-analysis run started");
  }

  const dataApiClient = createAgentDataApiClient({
    baseUrl: env.AGENT_DATA_API_URL,
    version: "v1",
    token,
  });

  try {
    const query = buildAnalysisGetQuery(inputForQuery);
    const ctx = await dataApiClient.analysis.get(query);

    const rawCount = ctx.dataSources.length;
    const sorted = sortAnalysisDataSourcesByCreatedAt(ctx.dataSources);
    const batch = applyMaxBatchSizeCap(sorted, inputForQuery.maxBatchSize);
    const selectedCount = batch.length;

    let message: string;
    if (rawCount === 0) {
      message = "analysis context loaded (0 source(s))";
    } else if (
      inputForQuery.maxBatchSize !== undefined &&
      selectedCount < rawCount
    ) {
      message = `analysis context loaded (${rawCount} source(s), processing batch of ${selectedCount})`;
    } else {
      message = `analysis context loaded (${rawCount} source(s))`;
    }

    return {
      success: true,
      message,
      details: {
        dataSourcesReturned: rawCount,
        dataSourcesSelected: selectedCount,
        reanalyze,
      },
    };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "agent-data-api analysis GET failed";
    logger.error({ tickerId: input.tickerId, err: error }, message);
    return { success: false, message };
  }
};
