import { createAgentDataApiClient } from "@workspace/agent-data-api-client";
import { createAgentApp, hermesTickerIdSchema } from "@workspace/agent-runtime";
/** Agent T3 env: import the typed `@mediapulse/env/agents-content-generation` module (not the root `@mediapulse/env` app bundle). */
import { env } from "@mediapulse/env/agents-content-generation";
import { logger } from "@workspace/logger";
import OpenAI from "openai";
import pRetry from "p-retry";
import { z } from "zod";

import {
  ContentGenerationConfigSchema,
  type ContentGenerationConfig,
} from "./config-schema.js";
import { generateContentWithOpenAI } from "./lib/generate-content.js";

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
    agentVersion: "1.0.0",
    inputSchema: BodySchema,
    configSchema: ContentGenerationConfigSchema,
    run: async ({ input, config, token }) => {
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
      logger.info({ config }, "Config");

      if (!sources?.length) {
        return {
          success: false,
          message: "No data sources found for this ticker",
        };
      }

      const openai = new OpenAI({
        apiKey: config.openai.apiKey,
        baseURL: config.openai.baseUrl,
        timeout: config.openai.timeoutMs,
      });
      const model = config.openai.model;
      const temperature = config.openai.temperature;
      const today = new Date().toISOString().split("T")[0];

      const generated = await pRetry(
        () =>
          generateContentWithOpenAI(sources, {
            openai,
            model,
            temperature,
            topNewsCount: config.output?.topNewsCount ?? 3,
            maxCharsPerSource: config.context?.maxCharsPerSource ?? 8000,
            maxTotalContextChars:
              config.context?.maxTotalContextChars ?? 100000,
            systemPrompt: config.prompts?.systemPrompt,
            userPromptTemplate: config.prompts?.userPromptTemplate,
            tickerId: input.tickerId,
            date: today,
          }),
        {
          retries: config.llmRetry?.maxAttempts ?? 3,
          minTimeout: config.llmRetry?.baseDelayMs ?? 500,
          maxTimeout: config.llmRetry?.maxDelayMs ?? 8000,
          onFailedAttempt: (error) => {
            logger.warn(
              { error, attempt: error.attemptNumber },
              "LLM generation failed, retrying...",
            );
          },
        },
      );
      try {
        await pRetry(
          () =>
            dataApiClient.contentGeneration.create({
              subject: generated.subject,
              content: generated.content,
              ...(generated.description && {
                description: generated.description,
              }),
              tickerId: input.tickerId,
            }),
          {
            retries: config.persistRetry?.maxAttempts ?? 2,
            minTimeout: config.persistRetry?.baseDelayMs ?? 200,
            maxTimeout: config.persistRetry?.maxDelayMs ?? 2000,
          },
        );
      } catch (err) {
        logger.error(
          { tickerId: input.tickerId, err },
          "Agent data API rejected newsletter store",
        );
        throw err;
      }

      logger.info({ tickerId: input.tickerId }, "Stored newsletter for ticker");
      return { success: true };
    },
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
  port: env.PORT ?? 4002,
  fetch: app.fetch,
};
