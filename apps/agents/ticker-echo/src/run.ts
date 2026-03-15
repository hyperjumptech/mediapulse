import { AgentRunContext, AgentResult } from "@workspace/agent-runtime";
import { logger } from "@workspace/logger";
import { Input, Config } from "./index.js";

// run is the business logic of the agent. It is called by the agent runtime when the agent is invoked.
export const run = async ({
  input,
  config,
}: AgentRunContext<Input, Config>): Promise<AgentResult> => {
  if (config.verbose) {
    // Use logger instead of console.log to log the message
    logger.info(
      { tickerId: input.tickerId },
      "--> ticker-echo received verbose",
    );
  }
  return { success: true };
};
