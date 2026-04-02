import { createAgentDataApiClient } from "@workspace/agent-data-api-client";
import type { AgentRunContext, AgentRunResult } from "@workspace/agent-runtime";
import { logger } from "@workspace/logger";
import { env } from "@mediapulse/env/agents-query-analysis";
import type { QueryAnalysisConfig } from "./config-schema";
import {
  buildQueryAnalysisSystemContent,
  buildQueryAnalysisUserContent,
  fetchLlmQueryCandidates,
} from "./llm-queries";
import { mergeQueryCandidates } from "./merge-query-candidates";

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
  const { input, config, token, hermesCorrelation } = context;
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

  const queryCount = config.queryCount ?? 10;
  const allowedLanguages = config.allowedLanguages ?? ["en"];
  const minDeterministicCount = config.minDeterministicCount ?? 4;
  const weightBreaking = config.weightBreaking ?? 1;
  const weightKgChange = config.weightKgChange ?? 0.8;
  const weightFundamental = config.weightFundamental ?? 0.6;
  const openaiModel = config.openaiModel ?? "gpt-4o-mini";
  const maxTokens = config.maxTokens ?? 800;

  const systemContent = buildQueryAnalysisSystemContent({
    queryCount,
    allowedLanguages,
    minDeterministicCount,
    weights: {
      breaking: weightBreaking,
      kgChange: weightKgChange,
      fundamental: weightFundamental,
    },
  });
  const userContent = buildQueryAnalysisUserContent(queryContext);

  let llmCandidates: Awaited<ReturnType<typeof fetchLlmQueryCandidates>> = [];
  try {
    llmCandidates = await fetchLlmQueryCandidates({
      apiKey: config.openaiApiKey,
      model: openaiModel,
      maxOutputTokens: maxTokens,
      messages: [
        { role: "system", content: systemContent },
        { role: "user", content: userContent },
      ],
    });
  } catch (error) {
    logger.warn(
      { error, tickerId: input.tickerId },
      "query-analysis LLM failed; using deterministic candidates only",
    );
  }

  const merged = mergeQueryCandidates({
    deterministic,
    llm: llmCandidates,
    queryCount,
    minDeterministicCount,
    weights: {
      breaking: weightBreaking,
      kgChange: weightKgChange,
      fundamental: weightFundamental,
    },
  });

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
    maxTokens,
  };

  const response = await client.queryAnalysis.create({
    tickerId: input.tickerId,
    generationSource: "hybrid_v1",
    strategySnapshot,
    activate: true,
    queries: merged,
    ...(hermesCorrelation?.jobId !== undefined
      ? { agentJobId: hermesCorrelation.jobId }
      : {}),
  });

  logger.info(
    { tickerId: input.tickerId, created: response.created },
    "query analysis set persisted",
  );
  return { success: true, details: response };
};
