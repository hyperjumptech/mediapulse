import { createAgentDataApiClient } from "@workspace/agent-data-api-client";
import type { AgentRunContext, AgentRunResult } from "@workspace/agent-runtime";
import { logger } from "@workspace/logger";
import OpenAI from "openai";
import { env } from "@mediapulse/env/agents-query-analysis";
import type { QueryAnalysisConfig } from "./config-schema";

type QueryAnalysisInput = { tickerId: string };

/**
 * Builds deterministic baseline query candidates.
 *
 * @param symbol - Ticker symbol.
 * @param name - Ticker display name.
 * @returns Deterministic query texts with intent labels.
 */
export const buildDeterministicQueries = (
  symbol: string,
  name: string,
): Array<{
  text: string;
  intent: "breaking" | "kg_change" | "fundamental";
}> => [
  { text: `${symbol} latest news`, intent: "breaking" },
  { text: `${name} breaking news`, intent: "breaking" },
  { text: `${name} relation changes`, intent: "kg_change" },
  { text: `${name} earnings guidance`, intent: "fundamental" },
  { text: `${name} regulatory update`, intent: "fundamental" },
];

/**
 * Runs the query-analysis agent for one ticker and persists an active query set.
 *
 * @param context - Agent run context with validated input/config and bearer token.
 * @returns Success response with created query count.
 */
export const runQueryAnalysis = async (
  context: AgentRunContext<QueryAnalysisInput, QueryAnalysisConfig>,
): Promise<AgentRunResult> => {
  const { input, config, token } = context;
  const client = createAgentDataApiClient({
    baseUrl: env.AGENT_DATA_API_URL,
    version: "v1",
    token,
  });

  const queryContext = await client.queryAnalysis.get({
    tickerId: input.tickerId,
  });
  const deterministic = buildDeterministicQueries(
    queryContext.ticker.symbol,
    queryContext.ticker.name,
  );

  const llm = new OpenAI({ apiKey: config.openaiApiKey });
  const queryCount = config.queryCount ?? 10;
  const allowedLanguages = config.allowedLanguages ?? ["en"];
  const minDeterministicCount = config.minDeterministicCount ?? 4;
  const weightBreaking = config.weightBreaking ?? 1;
  const weightKgChange = config.weightKgChange ?? 0.8;
  const weightFundamental = config.weightFundamental ?? 0.6;
  const openaiModel = config.openaiModel ?? "gpt-4o-mini";
  const llmResult = await llm.chat.completions.create({
    model: openaiModel,
    max_tokens: config.maxTokens,
    messages: [
      {
        role: "system",
        content:
          "Generate concise finance search queries as a JSON array of strings.",
      },
      {
        role: "user",
        content: `Ticker: ${queryContext.ticker.symbol} ${queryContext.ticker.name}`,
      },
    ],
    response_format: { type: "json_object" },
  });

  const llmText = llmResult.choices[0]?.message?.content ?? '{"queries":[]}';
  const parsed = JSON.parse(llmText) as { queries?: string[] };
  const llmQueries = (parsed.queries ?? [])
    .map((text, index) => ({
      text: text.trim(),
      source: "llm" as const,
      intent: "breaking" as const,
      rank: deterministic.length + index + 1,
    }))
    .filter((item) => item.text.length > 0);

  const merged = [
    ...deterministic.map((item, index) => ({
      text: item.text,
      source: "deterministic" as const,
      intent: item.intent,
      rank: index + 1,
    })),
    ...llmQueries,
  ].slice(0, queryCount);

  const strategySnapshot = {
    queryCount,
    allowedLanguages,
    minDeterministicCount,
    weights: {
      breaking: weightBreaking,
      kgChange: weightKgChange,
      fundamental: weightFundamental,
    },
    model: openaiModel,
    maxTokens: config.maxTokens,
  };

  const response = await client.queryAnalysis.create({
    tickerId: input.tickerId,
    generationSource: "hybrid_v1",
    strategySnapshot,
    activate: true,
    queries: merged,
  });

  logger.info(
    { tickerId: input.tickerId, created: response.created },
    "query analysis set persisted",
  );
  return { success: true, details: response };
};
