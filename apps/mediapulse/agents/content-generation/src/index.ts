import { createAgentDataApiClient } from "@workspace/agent-data-api-client";
import { createAgentApp } from "@workspace/agent-runtime";
import { env } from "@mediapulse/env/agents-content-generation";
import { logger } from "@workspace/logger";
import { z } from "zod";

import {
  ContentGenerationConfigSchema,
  type ContentGenerationConfig,
  resolveContentGenerationConfig,
} from "./config-schema.js";
import { classifyLlmError } from "./llm-classify-error.js";
import {
  generateNewsletterWithLlm,
  type SourceForGeneration,
} from "./llm-generate-newsletter.js";
import type { AgentOutcome } from "./types/outcome.js";

const BodySchema = z.object({
  tickerId: z.string(),
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
    agentVersion: "1.0.0",
    inputSchema: BodySchema,
    configSchema: ContentGenerationConfigSchema,
    run: async ({ input, config, token }) => {
      const resolvedConfig = resolveContentGenerationConfig(config);

      const dataApiClient = createAgentDataApiClient({
        baseUrl: env.AGENT_DATA_API_URL,
        version: "v1",
        token,
      });

      const { dataSources: sources } =
        await dataApiClient.contentGeneration.get({
          tickerId: input.tickerId,
        });

      logger.info({ sources }, "Data sources for ticker");
      logger.info({ config: resolvedConfig }, "Config");

      if (!sources?.length) {
        const outcome: AgentOutcome = {
          outcome: "no_sources",
          skipped: true,
          message: "No data sources found for this ticker",
        };
        logger.info(
          { tickerId: input.tickerId, outcome },
          "Skipping run: no data sources",
        );
        return {
          success: false,
          message: outcome.message ?? "No data sources found for this ticker",
        };
      }

      // Map API sources to the minimal shape needed by the LLM generator.
      const sourcesForLlm: SourceForGeneration[] = sources.map((s) => ({
        url: s.url,
        title: s.title,
        content: s.content,
      }));

      // Generate newsletter with retry-wrapped generateObject.
      let generated: Awaited<ReturnType<typeof generateNewsletterWithLlm>>;
      try {
        generated = await generateNewsletterWithLlm(
          sourcesForLlm,
          resolvedConfig,
        );
      } catch (err) {
        const code = classifyLlmError(err);
        const outcome: AgentOutcome = { outcome: code, skipped: false };
        logger.error(
          { tickerId: input.tickerId, outcome, err },
          "LLM generation failed",
        );
        return {
          success: false,
          message: `Newsletter generation failed: ${code}`,
        };
      }

      // Persist generated newsletter via agent-data-api.
      try {
        await dataApiClient.contentGeneration.create({
          subject: generated.subject,
          content: generated.content,
          ...(generated.description && {
            description: generated.description,
          }),
          tickerId: input.tickerId,
        });
      } catch (err) {
        const code = classifyPersistError(err);
        const outcome: AgentOutcome = { outcome: code, skipped: false };
        logger.error(
          { tickerId: input.tickerId, outcome, err },
          "Agent data API rejected newsletter store",
        );
        return {
          success: false,
          message: "Failed to store generated newsletter",
        };
      }

      logger.info({ tickerId: input.tickerId }, "Stored newsletter for ticker");
      return { success: true };
    },
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

/**
 * Classifies a persist error from the agent-data-api-client as transient or client error.
 *
 * Parses the HTTP status code from the error message thrown by the API client
 * (`"Agent data API error: <status>"`). 429 and 5xx codes are transient; all
 * others are treated as non-retryable client errors.
 *
 * @param err - Thrown value from `dataApiClient.contentGeneration.create`.
 * @returns `"persist_transient"` for 429/5xx, `"persist_client_error"` otherwise.
 */
function classifyPersistError(
  err: unknown,
): "persist_transient" | "persist_client_error" {
  if (err instanceof Error) {
    const match = /Agent data API error: (\d+)/.exec(err.message);
    if (match) {
      const status = parseInt(match[1] ?? "", 10);
      if (status === 429 || status >= 500) {
        return "persist_transient";
      }
    }
  }
  return "persist_client_error";
}

export default {
  port: env.PORT ?? 4002,
  fetch: app.fetch,
};
