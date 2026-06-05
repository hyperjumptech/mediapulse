import { createAgentApp } from "@workspace/agent-runtime";
import { env } from "@mediapulse/env/agents-user-registration";
import { z } from "zod";

import { run, type Input } from "./run.js";
import {
  ConfigSchema,
  type UserRegistrationConfig as Config,
} from "./config-schema.js";

/**
 * Extracts an HTTP status code from the agent-data-api-client error message shape.
 *
 * The SDK currently throws plain `Error("Agent data API error: <statusCode>")` for non-2xx
 * responses, so we parse that string to decide whether a failure is worth retrying.
 *
 * @param error - Unknown thrown value from the SDK call.
 * @returns The parsed HTTP status code, or null when not present.
 */
function getAgentDataApiStatusCode(error: unknown): number | null {
  if (!(error instanceof Error)) return null;
  const match = /Agent data API error:\s*(\d{3})/.exec(error.message);
  if (!match) return null;
  const code = Number(match[1]);
  return Number.isFinite(code) ? code : null;
}

/**
 * Calls a function with a single bounded retry for transient failures.
 *
 * @param params - Collaborators and retry configuration.
 * @param params.fn - Async operation to execute.
 * @param params.maxAttempts - Maximum attempts including the first call.
 * @param params.shouldRetry - Decides whether an error is transient.
 * @returns The successful result and the number of attempts used.
 */
async function callWithRetry<TResult>(params: {
  fn: () => Promise<TResult>;
  maxAttempts: number;
  shouldRetry: (error: unknown) => boolean;
}): Promise<{ result: TResult; attempts: number }> {
  const { fn, maxAttempts, shouldRetry } = params;

  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const result = await fn();
      return { result, attempts: attempt };
    } catch (error) {
      lastError = error;
      if (attempt >= maxAttempts || !shouldRetry(error)) {
        throw error;
      }
    }
  }

  // This is unreachable due to the loop bounds, but keeps TypeScript satisfied.
  throw lastError;
}

/**
 * Lower bound for messages processed per run. Oldest-first ordering means a
 * single slow or failing message blocks all progress, so a value like 1 is
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
    agentId: "user-registration",
    agentVersion: "1.0.0",
    description:
      "Reads Outlook for newsletter signup messages, registers users and tickers via agent-data-api, and sends confirmation email.",
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
