import { createAgentApp } from "@workspace/agent-runtime";
import { env } from "@mediapulse/env/agents-knowledge-ingestion";
import { z } from "zod";
import { run } from "./run.js";
import { AGENT_ID, AGENT_VERSION } from "./agent-version.js";

const InputSchema = z.object({
  since: z.string().datetime().optional(),
  limit: z.number().int().positive().max(20000).optional(),
  fromStart: z.boolean().optional(),
});

const ConfigSchema = z.object({
  dryRun: z.boolean().optional(),
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
    agentId: AGENT_ID,
    agentVersion: AGENT_VERSION,
    description:
      "Groups collected articles into Storylines so recurring news can be recognised.",
    inputSchema: InputSchema,
    configSchema: ConfigSchema,
    run,
  },
  {
    authApiUrl: env.AGENT_AUTH_API_URL ?? "",
    autoRegister:
      env.AGENT_REGISTRY_URL &&
      env.DOMAIN_INTEGRATION_API_KEY &&
      env.AGENT_PUBLIC_URL
        ? {
            registryUrl: env.AGENT_REGISTRY_URL,
            domainIntegrationId: env.DOMAIN_INTEGRATION_ID,
            domainIntegrationApiKey: env.DOMAIN_INTEGRATION_API_KEY,
            agentUrl: env.AGENT_PUBLIC_URL,
          }
        : undefined,
  },
);

export default {
  port: env.PORT ?? 4013,
  fetch: app.fetch,
};
