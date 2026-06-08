import type { AgentRunContext, AgentRunResult } from "@workspace/agent-runtime";

import type { BodySchemaType } from "./utilities/body-schema";
import type { ConfigSchemaType } from "./utilities/config-schema";

/**
 * Stub run for the page-collection agent.
 *
 * The full pipeline is implemented in Plan 97. This stub returns an empty
 * success result so the agent scaffolding can be verified end-to-end.
 *
 * @param context - Agent run context carrying the input body and resolved config.
 */
export async function runPageCollection(
  _context: AgentRunContext<BodySchemaType, ConfigSchemaType>,
): Promise<AgentRunResult> {
  return {
    success: true,
    details: {
      summary: {},
    },
  };
}
