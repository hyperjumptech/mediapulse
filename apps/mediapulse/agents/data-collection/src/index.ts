import { createAgentApp } from "@workspace/agent-runtime";
import { env } from "@mediapulse/env/agents-data-collection";

import { ConfigSchema, type ConfigSchemaType } from "./utilities/config-schema";
import { BodySchema, type BodySchemaType } from "./utilities/body-schema";
import { runDataCollection } from "./run";

const app = createAgentApp<
  BodySchemaType,
  typeof BodySchema,
  ConfigSchemaType,
  typeof ConfigSchema
>(
  {
    agentId: "data-collection",
    agentVersion: "1.0.0",
    inputSchema: BodySchema,
    configSchema: ConfigSchema,
    run: runDataCollection,
  },
  {
    authApiUrl: env.AGENT_AUTH_API_URL,
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
  port: env.PORT ?? 4001,
  fetch: app.fetch,
};
