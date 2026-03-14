import { createAgentApp } from "@workspace/agent-runtime";
import { env } from "@workspace/env/agents-ticker-echo";
import { z } from "zod";

const InputSchema = z.object({
  tickerId: z.string().min(1),
});

type Input = z.infer<typeof InputSchema>;

const app = createAgentApp<Input, typeof InputSchema>(
  {
    agentId: "ticker-echo",
    agentVersion: "1.0.0",
    inputSchema: InputSchema,
    run: async ({ input }) => {
      console.log("--> ticker-echo received tickerId", input.tickerId);
      return { success: true };
    },
  },
  {
    authApiUrl: env.AGENT_AUTH_API_URL ?? "",
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
