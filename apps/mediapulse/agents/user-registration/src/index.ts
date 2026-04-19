import { createAgentApp } from "@workspace/agent-runtime";
import { env } from "@mediapulse/env/agents-user-registration";
import { z } from "zod";

import { run, type Input } from "./run.js";
import {
  ConfigSchema,
  type UserRegistrationConfig as Config,
} from "./config-schema.js";

const BodySchemaInner = z.object({
  maxMessagesPerRun: z.number().default(20),
  watermark: z.string().datetime().optional(),
});
const BodySchema = BodySchemaInner as unknown as z.ZodType<
  Input,
  z.ZodTypeDef,
  Input
>;

const app = createAgentApp<
  Input,
  typeof BodySchema,
  Config,
  typeof ConfigSchema
>(
  {
    agentId: "user-registration",
    agentVersion: "1.1.0",
    inputSchema: BodySchema,
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
  port: env.PORT ?? 4004,
  fetch: app.fetch,
};
