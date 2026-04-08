import { createAgentDataApiClient } from "@workspace/agent-data-api-client";
import type { AgentRunContext, AgentRunResult } from "@workspace/agent-runtime";
import { env } from "@mediapulse/env/agents-article-analysis";
import { logger } from "@workspace/logger";

import type { Config, Input } from "./index.js";

/**
 * Loads analysis context for the ticker (incremental unanalyzed sources only).
 *
 * @param context - Validated input, optional config, and bearer token for agent-data-api.
 * @returns Success with a short backlog summary, or failure when the data API call fails.
 */
export const run = async ({
  input,
  config,
  token,
}: AgentRunContext<Input, Config>): Promise<AgentRunResult> => {
  if (config.verbose) {
    logger.info({ tickerId: input.tickerId }, "article-analysis run started");
  }

  const dataApiClient = createAgentDataApiClient({
    baseUrl: env.AGENT_DATA_API_URL,
    version: "v1",
    token,
  });

  try {
    const ctx = await dataApiClient.analysis.get({
      tickerId: input.tickerId,
      unanalyzed: true,
    });

    return {
      success: true,
      message: `analysis context loaded (${ctx.dataSources.length} unanalyzed source(s))`,
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
