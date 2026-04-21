import { createAgentDataApiClient } from "@workspace/agent-data-api-client";
import { createAgentApp, hermesTickerIdSchema } from "@workspace/agent-runtime";
/** Agent T3 env: import the typed `@mediapulse/env/agents-content-generation` module (not the root `@mediapulse/env` app bundle). */
import { env } from "@mediapulse/env/agents-content-generation";
import { z } from "zod";

import {
  ContentGenerationConfigSchema,
  type ContentGenerationConfig,
} from "./config-schema.js";
import { AGENT_VERSION } from "./agent-version.js";
import { run } from "./run.js";

const BodySchema = z.object({
  tickerId: hermesTickerIdSchema,
});

type Input = z.infer<typeof BodySchema>;

const app = createAgentApp<
  Input,
  typeof BodySchema,
  ContentGenerationConfig,
  typeof ContentGenerationConfigSchema
>(
  {
    agentId: "content-generation",
    agentVersion: AGENT_VERSION,
    inputSchema: BodySchema,
    configSchema: ContentGenerationConfigSchema,
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
  port: env.PORT ?? 4002,
  fetch: app.fetch,
};
