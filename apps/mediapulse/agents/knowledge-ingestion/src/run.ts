import { AgentRunContext, AgentRunResult } from "@workspace/agent-runtime";
import { logger } from "@workspace/logger";
import { Input, Config } from "./index.js";
import { AGENT_VERSION } from "./agent-version.js";

/**
 * Reason returned while the agent has no storage behind it.
 *
 * - Important: the decision rule and its storage exist, but agents reach the domain database only
 *   through agent-data-api, and the Storyline endpoints are not built yet. Failing loudly is
 *   deliberate: a run that silently reported zero work would look like an empty corpus rather than
 *   an unwired agent.
 */
export const STORE_NOT_WIRED =
  "knowledge-ingestion has no store: the agent-data-api Storyline endpoints are not implemented yet";

export const run = async ({
  input,
  config,
}: AgentRunContext<Input, Config>): Promise<AgentRunResult> => {
  logger.warn(
    {
      agentVersion: AGENT_VERSION,
      since: input.since,
      limit: input.limit,
      dryRun: config.dryRun ?? false,
    },
    "--> knowledge-ingestion invoked before its store exists",
  );

  return {
    success: false,
    message: STORE_NOT_WIRED,
    details: { considered: 0, storylinesOpened: 0, developmentsOpened: 0 },
  };
};
