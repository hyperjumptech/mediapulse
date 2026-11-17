import { env } from "@mediapulse/env/agents-knowledge-ingestion";
import { createAgentApp } from "@workspace/agent-runtime";
import { z } from "zod";

import { AGENT_ID, AGENT_VERSION } from "./agent-version.js";
import { ConfigSchema } from "./config-schema.js";
import { run, type Config, type Input } from "./run.js";

const InputSchema = z.object({
  limit: z.number().int().positive().max(500).optional(),
}) as unknown as z.ZodType<Input>;

const app = createAgentApp<
  Input,
  typeof InputSchema,
  Config,
  typeof ConfigSchema
>(
  {
    agentId: AGENT_ID,
    agentVersion: AGENT_VERSION,
    description:
      "Sends each placed article to the knowledge graph as one ingestion job, fetching a missing body first, retries each failed job once, and reports what the articles sent before the run added.",
    inputSchema: InputSchema,
    configSchema: ConfigSchema,
    run,
  },
  {
    authApiUrl: env.AGENT_AUTH_API_URL,
    autoRegister:
      env.AGENT_REGISTRY_URL &&
      env.DOMAIN_INTEGRATION_API_KEY &&
      env.AGENT_PUBLIC_URL &&
      env.AGENT_AUTH_API_URL
        ? {
            registryUrl: env.AGENT_REGISTRY_URL,
            domainIntegrationId: env.DOMAIN_INTEGRATION_ID,
            domainIntegrationApiKey: env.DOMAIN_INTEGRATION_API_KEY,
            agentUrl: env.AGENT_PUBLIC_URL,
          }
        : undefined,
  },
);

export { app };

export default {
  port: env.PORT ?? 4013,
  fetch: app.fetch,
};
