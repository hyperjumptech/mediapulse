import { createAgentApp } from "@workspace/agent-runtime";
import { env } from "@mediapulse/env/agents-article-analysis";
import { z } from "zod";
import { run } from "./run";

// InputSchema is the schema for the input of the agent, which will be sent by Hermes to the agent when the agent is invoked
const InputSchema = z.object({
  tickerId: z.string().trim().min(1),
});

// ConfigSchema is the schema for the config of the agent, which will be sent by Hermes to the agent when the agent is invoked
const ConfigSchema = z.object({
  verbose: z.boolean().optional(),
});

export type Config = z.infer<typeof ConfigSchema>;
export type Input = z.infer<typeof InputSchema>;

const app = createAgentApp<
  Input,
  typeof InputSchema,
  Config,
  typeof ConfigSchema
>(
  {
    agentId: "article-analysis", // this should be stable for the lifetime of the agent
    agentVersion: "1.0.0", // this should be incremented when the agent is updated
    description:
      "Loads analysis context from agent-data-api (unanalyzed sources) per ticker. Extraction and scoring follow in later milestones.", // Optional description of the agent but recommended for admins to see in the agent registry
    inputSchema: InputSchema,
    configSchema: ConfigSchema,
    run,
  },
  // Options for the agent app
  {
    // Auto-register: AGENT_REGISTRY_URL, AGENT_PUBLIC_URL, DOMAIN_INTEGRATION_API_KEY, AGENT_AUTH_API_URL
    authApiUrl: env.AGENT_AUTH_API_URL ?? "",
    autoRegister:
      env.AGENT_REGISTRY_URL &&
      env.DOMAIN_INTEGRATION_API_KEY &&
      env.AGENT_PUBLIC_URL
        ? {
            registryUrl: env.AGENT_REGISTRY_URL,
            domainIntegrationId: env.DOMAIN_INTEGRATION_ID ?? "mediapulse",
            domainIntegrationApiKey: env.DOMAIN_INTEGRATION_API_KEY,
            agentUrl: env.AGENT_PUBLIC_URL,
          }
        : undefined,
  },
);

// Export the agent app as a default export
export default {
  port: env.PORT ?? 4010,
  fetch: app.fetch,
};
