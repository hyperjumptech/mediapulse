import { createAgentApp } from "@workspace/agent-runtime";
import { env } from "@workspace/env/agents-ticker-echo";
import { logger } from "@workspace/logger";
import { z } from "zod";

const InputSchema = z.object({
  tickerId: z.string().min(1),
});

type Input = z.infer<typeof InputSchema>;

/**
 * Minimal agent for local scheduler testing. Accepts tickerId as input,
 * logs it, and returns success. No side effects; safe to run with the
 * hermes-worker DataQueue flow.
 */
const app = createAgentApp<Input, typeof InputSchema>(
  {
    agentId: "ticker-echo",
    agentVersion: "1.0.0",
    inputSchema: InputSchema,
    run: async ({ input }) => {
      logger.info(
        { tickerId: input.tickerId, agentId: "ticker-echo" },
        "ticker-echo received tickerId",
      );
      return { success: true };
    },
  },
  {
    authApiUrl: env.AGENT_AUTH_API_URL ?? "",
    verifyToken:
      env.ALLOW_ANY_BEARER_FOR_LOCAL === "true" ? async () => true : undefined,
    autoRegister:
      env.AGENT_REGISTRY_URL &&
      env.AGENT_REGISTRY_API_KEY &&
      env.AGENT_PUBLIC_URL
        ? {
            registryUrl: env.AGENT_REGISTRY_URL,
            apiKey: env.AGENT_REGISTRY_API_KEY,
            agentUrl: env.AGENT_PUBLIC_URL,
          }
        : undefined,
  },
);

export default {
  port: env.PORT ?? 4010,
  fetch: app.fetch,
};
