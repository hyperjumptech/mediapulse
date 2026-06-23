import { createAgentApp } from "@workspace/agent-runtime";
import { env } from "@mediapulse/env/agents-newsletter-feedback";
import { z } from "zod";

import { run, type Input } from "./run.js";
import {
  ConfigSchema,
  type NewsletterFeedbackConfig as Config,
} from "./config-schema.js";

/**
 * Lower bound for messages processed per run. Oldest-first ordering means a
 * single slow or failing message blocks progress, so a tiny value is
 * pathological. The floor guarantees each run drains a real batch.
 */
const MIN_MAX_MESSAGES_PER_RUN = 10;

const BodySchemaInner = z.object({
  maxMessagesPerRun: z
    .number()
    .default(20)
    .transform((value) => Math.max(value, MIN_MAX_MESSAGES_PER_RUN)),
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
    agentId: "newsletter-feedback",
    agentVersion: "1.0.0",
    description:
      "Reads newsletter replies from Outlook, classifies sentiment and category with an LLM, and records the feedback via agent-data-api.",
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
  port: env.PORT ?? 4012,
  fetch: app.fetch,
};
