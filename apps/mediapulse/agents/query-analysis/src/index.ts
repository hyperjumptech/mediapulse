import { createAgentDataApiClient } from "@workspace/agent-data-api-client";
import { createAgentApp } from "@workspace/agent-runtime";
import { env } from "@mediapulse/env/agents-query-analysis";
import { logger } from "@workspace/logger";
import { z } from "zod";

const BodySchema = z.object({
  tickerId: z.string().uuid(),
  agentJobId: z.string().optional(),
});

const ConfigSchema = z.object({
  openaiApiKey: z
    .string()
    .min(1)
    .optional()
    .describe(
      "OpenAI API key used for LLM query generation. Falls back to the OPENAI_API_KEY environment variable if not set.",
    ),
  model: z
    .string()
    .optional()
    .describe(
      "OpenAI model to use for generation (e.g. gpt-4o). Defaults to gpt-4o.",
    ),
  maxTokens: z
    .number()
    .int()
    .positive()
    .optional()
    .describe(
      "Maximum number of tokens for the LLM completion. Defaults to 1000.",
    ),
  queryCount: z
    .number()
    .int()
    .positive()
    .optional()
    .describe(
      "Target number of queries to generate per ticker per run. Defaults to 10.",
    ),
  minDeterministicCount: z
    .number()
    .int()
    .nonnegative()
    .optional()
    .describe(
      "Minimum number of deterministic baseline queries guaranteed in every set. Defaults to 3.",
    ),
  allowedLanguages: z
    .array(z.string().min(1))
    .optional()
    .describe(
      'List of allowed language codes for generated queries (e.g. ["en"]). Defaults to ["en"].',
    ),
  weightBreaking: z
    .number()
    .min(0)
    .max(1)
    .optional()
    .describe(
      "Priority weight for breaking-news intent queries (0–1). Defaults to 0.5.",
    ),
  weightKgChange: z
    .number()
    .min(0)
    .max(1)
    .optional()
    .describe(
      "Priority weight for knowledge-graph relation-change intent queries (0–1). Defaults to 0.3.",
    ),
  weightFundamental: z
    .number()
    .min(0)
    .max(1)
    .optional()
    .describe(
      "Priority weight for fundamental-analysis intent queries (0–1). Defaults to 0.2.",
    ),
});

type Input = z.infer<typeof BodySchema>;
type Config = z.infer<typeof ConfigSchema>;

type QueryIntent = "breaking" | "kg_change" | "fundamental";
type QuerySource = "deterministic" | "llm";

interface CandidateQuery {
  text: string;
  intent: QueryIntent;
  source: QuerySource;
}

const app = createAgentApp<
  Input,
  typeof BodySchema,
  Config,
  typeof ConfigSchema
>(
  {
    agentId: "query-analysis",
    agentVersion: "1.0.0",
    description:
      "Generates versioned, ticker-specific search query sets once per day using a deterministic baseline plus LLM enrichment.",
    inputSchema: BodySchema,
    configSchema: ConfigSchema,
    run: async ({ input, config, token, hermesCorrelation }) => {
      // Resolve effective config: dashboard config values take precedence, env vars are fallback
      const openaiApiKey = config.openaiApiKey ?? env.OPENAI_API_KEY;
      const model =
        config.model ??
        env.QUERY_ANALYSIS_MODEL ??
        env.OPENAI_MODEL ??
        "gpt-4o";
      const maxTokens =
        config.maxTokens ?? env.QUERY_ANALYSIS_MAX_TOKENS ?? 1000;
      const queryCount =
        config.queryCount ?? env.QUERY_ANALYSIS_QUERY_COUNT ?? 10;
      const minDeterministicCount =
        config.minDeterministicCount ??
        env.QUERY_ANALYSIS_MIN_DETERMINISTIC_COUNT ??
        3;
      const allowedLanguages =
        config.allowedLanguages ??
        (env.QUERY_ANALYSIS_ALLOWED_LANGUAGES
          ? (JSON.parse(env.QUERY_ANALYSIS_ALLOWED_LANGUAGES) as string[])
          : ["en"]);
      const weightBreaking =
        config.weightBreaking ?? env.QUERY_ANALYSIS_WEIGHT_BREAKING ?? 0.5;
      const weightKgChange =
        config.weightKgChange ?? env.QUERY_ANALYSIS_WEIGHT_KG_CHANGE ?? 0.3;
      const weightFundamental =
        config.weightFundamental ??
        env.QUERY_ANALYSIS_WEIGHT_FUNDAMENTAL ??
        0.2;

      const effectiveConfig = {
        queryCount,
        allowedLanguages,
        minDeterministicCount,
        weightBreaking,
        weightKgChange,
        weightFundamental,
        model,
        maxTokens,
      };

      const dataApiClient = createAgentDataApiClient({
        baseUrl: env.AGENT_DATA_API_URL,
        version: "v1",
        token,
      });

      // 1. Fetch query-analysis context from agent-data-api
      const context = await dataApiClient.queryAnalysis.get({
        tickerId: input.tickerId,
      });
      const { ticker, topEntities } = context;

      logger.info(
        {
          tickerId: input.tickerId,
          tickerSymbol: ticker.symbol,
          agentJobId: hermesCorrelation?.jobId ?? input.agentJobId,
          effectiveConfig,
        },
        "query-analysis: starting run",
      );

      // 2. Build deterministic baseline queries
      const deterministicCandidates: CandidateQuery[] = [
        {
          text: `${ticker.symbol} latest news`,
          source: "deterministic",
          intent: "breaking",
        },
        {
          text: `${ticker.name} breaking news`,
          source: "deterministic",
          intent: "breaking",
        },
        {
          text: `${ticker.name} earnings guidance`,
          source: "deterministic",
          intent: "fundamental",
        },
        {
          text: `${ticker.name} regulatory update`,
          source: "deterministic",
          intent: "breaking",
        },
        {
          text: `${ticker.name} partnership announcement`,
          source: "deterministic",
          intent: "kg_change",
        },
        {
          text: `${ticker.name} analyst rating`,
          source: "deterministic",
          intent: "fundamental",
        },
        {
          text: `${ticker.symbol} stock price movement`,
          source: "deterministic",
          intent: "breaking",
        },
      ];

      // Ensure we have at least minDeterministicCount deterministic queries
      const deterministicSlice = deterministicCandidates.slice(
        0,
        Math.max(minDeterministicCount, deterministicCandidates.length),
      );

      // 3. Run LLM to add or optimize candidate queries
      let llmCandidates: CandidateQuery[] = [];

      if (openaiApiKey) {
        try {
          const entitiesList = topEntities
            .slice(0, 5)
            .map((e) => e.canonicalName)
            .join(", ");

          const llmQueryCount = Math.max(
            queryCount - deterministicSlice.length,
            queryCount,
          );

          const prompt = `Generate search queries to find the latest financial news for the company "${ticker.name}" (ticker symbol: ${ticker.symbol}).
Consider these related entities for context: ${entitiesList || "none"}.
Return a JSON object with a "queries" array. Each object in the array MUST have:
- "text": the search query string (concise, suitable for a web search engine, in one of these languages: ${allowedLanguages.join(", ")})
- "intent": one of "breaking" (latest news/events), "kg_change" (entity relationship changes, mergers, partnerships), or "fundamental" (earnings, financials, analyst ratings).
Priority order: breaking > kg_change > fundamental.
Generate exactly ${llmQueryCount} highly relevant and diverse queries. Do not duplicate the following baseline queries: ${deterministicSlice.map((q) => q.text).join("; ")}.`;

          const res = await fetch(
            "https://api.openai.com/v1/chat/completions",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${openaiApiKey}`,
              },
              body: JSON.stringify({
                model,
                max_tokens: maxTokens,
                response_format: { type: "json_object" },
                messages: [
                  {
                    role: "system",
                    content:
                      "You are an expert financial news search query generator. Output only valid JSON.",
                  },
                  { role: "user", content: prompt },
                ],
              }),
            },
          );

          if (res.ok) {
            const json = (await res.json()) as {
              choices?: Array<{ message?: { content?: string } }>;
            };
            const content = json.choices?.[0]?.message?.content;
            if (content) {
              const parsed = JSON.parse(content) as {
                queries?: Array<{ text?: unknown; intent?: unknown }>;
              };
              if (parsed.queries && Array.isArray(parsed.queries)) {
                const validIntents: QueryIntent[] = [
                  "breaking",
                  "kg_change",
                  "fundamental",
                ];
                llmCandidates = parsed.queries
                  .filter(
                    (q) =>
                      typeof q.text === "string" && q.text.trim().length > 0,
                  )
                  .map((q) => ({
                    text: (q.text as string).trim(),
                    intent: validIntents.includes(q.intent as QueryIntent)
                      ? (q.intent as QueryIntent)
                      : "breaking",
                    source: "llm" as const,
                  }));
              }
            }
          } else {
            logger.warn(
              { status: res.status, tickerSymbol: ticker.symbol },
              "query-analysis: LLM generation failed, using deterministic-only set",
            );
          }
        } catch (err) {
          logger.warn(
            { err, tickerSymbol: ticker.symbol },
            "query-analysis: LLM generation error, falling back to deterministic baseline",
          );
        }
      } else {
        logger.warn(
          { tickerSymbol: ticker.symbol },
          "query-analysis: no OpenAI API key configured, using deterministic-only set",
        );
      }

      // 4. Merge, normalize, and dedupe
      const allCandidates = [...deterministicSlice, ...llmCandidates];
      const uniqueQueries = new Map<string, CandidateQuery>();

      for (const candidate of allCandidates) {
        const normalized = candidate.text.toLowerCase().trim();
        if (!uniqueQueries.has(normalized)) {
          uniqueQueries.set(normalized, candidate);
        }
      }

      const candidates = Array.from(uniqueQueries.values());

      // 5. Score and enforce size/priority limits
      const intentWeights: Record<QueryIntent, number> = {
        breaking: weightBreaking,
        kg_change: weightKgChange,
        fundamental: weightFundamental,
      };

      candidates.sort((a, b) => {
        // Deterministic queries get a small bump to guarantee baseline representation
        const sourceScoreA = a.source === "deterministic" ? 0.05 : 0;
        const sourceScoreB = b.source === "deterministic" ? 0.05 : 0;
        const scoreA = intentWeights[a.intent] + sourceScoreA;
        const scoreB = intentWeights[b.intent] + sourceScoreB;
        return scoreB - scoreA;
      });

      const finalQueries = candidates.slice(0, queryCount).map((q, index) => ({
        text: q.text,
        intent: q.intent,
        source: q.source,
        rank: index + 1,
      }));

      logger.info(
        {
          tickerSymbol: ticker.symbol,
          total: finalQueries.length,
          deterministic: finalQueries.filter(
            (q) => q.source === "deterministic",
          ).length,
          llm: finalQueries.filter((q) => q.source === "llm").length,
          agentJobId: hermesCorrelation?.jobId ?? input.agentJobId,
        },
        "query-analysis: persisting query set",
      );

      // 6. Persist as new versioned query set and activate it
      const persistResult = await dataApiClient.queryAnalysis.create({
        tickerId: input.tickerId,
        queries: finalQueries,
        strategySnapshot: effectiveConfig as Record<string, unknown>,
        agentJobId: hermesCorrelation?.jobId ?? input.agentJobId ?? null,
        activate: true,
        generationSource: "hybrid_v1",
      });

      logger.info(
        {
          tickerSymbol: ticker.symbol,
          created: persistResult.created,
          createdSetId: persistResult.createdSetId,
          activeSetId: persistResult.activeSetId,
          agentJobId: hermesCorrelation?.jobId ?? input.agentJobId,
        },
        "query-analysis: run complete",
      );

      return {
        success: true,
        message: `Created ${persistResult.created} queries for ${ticker.symbol} (set ${persistResult.createdSetId})`,
      };
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
            domainIntegrationId: env.DOMAIN_INTEGRATION_ID ?? "mediapulse",
            domainIntegrationApiKey: env.DOMAIN_INTEGRATION_API_KEY,
            agentUrl: env.AGENT_PUBLIC_URL,
          }
        : undefined,
  },
);

export { app };

export default {
  port: env.PORT ?? 4005,
  fetch: app.fetch,
};
