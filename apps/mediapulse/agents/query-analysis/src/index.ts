import { createAgentDataApiClient } from "@workspace/agent-data-api-client";
import { createAgentApp } from "@workspace/agent-runtime";
import { env } from "@mediapulse/env/agents-query-analysis";
import { logger } from "@workspace/logger";
import OpenAI from "openai";
import { z } from "zod";

import { ConfigSchema } from "./config-schema.js";
import { generateDeterministicQueries } from "./deterministic-generator.js";
import { generateLlmQueries } from "./llm-generator.js";
import { rankAndTrim } from "./query-ranker.js";
import type { RawCandidate } from "./query-ranker.js";

const BodySchema = z.object({
  tickerId: z.string().uuid(),
});

type Input = z.infer<typeof BodySchema>;

const app = createAgentApp(
  {
    agentId: "query-analysis",
    agentVersion: "1.0.0",
    description:
      "Generates versioned ticker search query sets using deterministic templates and LLM enrichment.",
    inputSchema: BodySchema,
    configSchema: ConfigSchema,
    run: async ({ input, config, token, hermesCorrelation }) => {
      const dataApiClient = createAgentDataApiClient({
        baseUrl: env.AGENT_DATA_API_URL,
        version: "v1",
        token,
      });

      // Step 1 — Fetch generation context
      const context = await dataApiClient.queryAnalysis.get({
        tickerId: input.tickerId,
      });

      const tickerCtx = {
        symbol: context.ticker.symbol,
        name: context.ticker.name,
        topEntities: context.topEntities,
        recentThemes: context.recentThemes,
      };

      // Step 2 — Deterministic baseline
      const deterministicQueries = generateDeterministicQueries(
        tickerCtx,
        config.minDeterministicCount,
      );

      // Step 3 — LLM enrichment (non-fatal: empty array on failure)
      const llmTargetCount = Math.max(
        0,
        config.queryCount - deterministicQueries.length,
      );
      let llmQueries: Array<{ text: string; intent: "breaking" | "kg_change" | "fundamental" }> = [];

      if (llmTargetCount > 0) {
        const openai = new OpenAI({ apiKey: config.openaiApiKey });
        llmQueries = await generateLlmQueries(
          tickerCtx,
          deterministicQueries.map((q) => q.text),
          {
            openai,
            model: config.openaiModel ?? "gpt-4o-mini",
            maxTokens: config.maxTokens,
            targetCount: llmTargetCount,
          },
        );
      }

      // Step 4 — Merge, rank, trim
      const candidates: RawCandidate[] = [
        ...deterministicQueries.map((q) => ({
          text: q.text,
          intent: q.intent,
          source: "deterministic" as const,
        })),
        ...llmQueries.map((q) => ({
          text: q.text,
          intent: q.intent,
          source: "llm" as const,
        })),
      ];

      const ranked = rankAndTrim(candidates, {
        queryCount: config.queryCount,
        weights: {
          breaking:    config.weightBreaking,
          kg_change:   config.weightKgChange,
          fundamental: config.weightFundamental,
        },
      });

      if (ranked.length === 0) {
        return { success: false, message: "No queries generated for ticker" };
      }

      // Step 5 — Build strategy snapshot (no secrets)
      const strategySnapshot: Record<string, unknown> = {
        queryCount:            config.queryCount,
        minDeterministicCount: config.minDeterministicCount,
        allowedLanguages:      config.allowedLanguages,
        weights: {
          breaking:    config.weightBreaking,
          kg_change:   config.weightKgChange,
          fundamental: config.weightFundamental,
        },
        model:       config.openaiModel ?? "gpt-4o-mini",
        maxTokens:   config.maxTokens,
        generatedAt: new Date().toISOString(),
        isFallback:  llmQueries.length === 0,
      };

      // Step 6 — Persist and activate
      const result = await dataApiClient.queryAnalysis.create({
        tickerId:         input.tickerId,
        queries:          ranked,
        strategySnapshot,
        generationSource: "hybrid_v1",
        agentJobId:       hermesCorrelation?.agentJobId,
      });

      logger.info(
        {
          tickerId:   input.tickerId,
          setId:      result.setId,
          agentJobId: hermesCorrelation?.agentJobId ?? null,
          created:    result.created,
          isFallback: llmQueries.length === 0,
        },
        "Query set persisted and activated",
      );

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
            registryUrl:             env.AGENT_REGISTRY_URL,
            domainIntegrationKey:    env.DOMAIN_INTEGRATION_KEY ?? "mediapulse",
            domainIntegrationApiKey: env.DOMAIN_INTEGRATION_API_KEY,
            agentUrl:                env.AGENT_PUBLIC_URL,
          }
        : undefined,
  },
);

export default {
  port:  env.PORT ?? 4004,
  fetch: app.fetch,
};
