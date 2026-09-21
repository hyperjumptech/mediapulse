import { createAgentApp, hermesTickerIdSchema } from "@workspace/agent-runtime";
import { env } from "@mediapulse/env/agents-knowledge-ingestion";
import { z } from "zod";
import { run } from "./run.js";
import { AGENT_ID, AGENT_VERSION } from "./agent-version.js";

const InputSchema = z.object({
  /** Extraction is per issuer: an entity's relevance to a ticker is a per-ticker fact. */
  tickerId: hermesTickerIdSchema,
  since: z.string().datetime().optional(),
  limit: z.number().int().positive().max(500).optional(),
  fromStart: z.boolean().optional(),
});

const ConfigSchema = z.object({
  model: z.string().default("{{AI_MODEL}}"),
  apiKey: z.string().default("{{AI_API_KEY}}"),
  baseUrl: z.string().default("{{AI_BASE_URL}}"),
  /**
   * Articles read at once. Reading is a model call of roughly half a minute, so reading one at a
   * time puts a full batch past the invoke-agent job timeout. Writes stay sequential whatever this
   * is set to, because resolving an entity is find-then-create.
   */
  readConcurrency: z.number().int().min(1).max(8).default(4),
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
      "Reads an issuer's articles for the entities they name and the relations they state, building that issuer's knowledge base.",
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
