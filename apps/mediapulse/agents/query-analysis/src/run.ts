import { createAgentDataApiClient } from "@workspace/agent-data-api-client";
import type { AgentRunContext, AgentRunResult } from "@workspace/agent-runtime";
import { computeLlmPromptFingerprint } from "@workspace/agent-llm-prompt-template";
import { logger } from "@workspace/logger";
import { env } from "@mediapulse/env/agents-query-analysis";
import type { QueryAnalysisConfig } from "./config-schema";
import {
  resolveQueryAnalysisSystemContent,
  resolveQueryAnalysisUserContent,
  fetchLlmQueryCandidates,
} from "./llm-queries";
import { mergeQueryCandidates } from "./merge-query-candidates";
import { buildDeterministicQueries } from "./templates/build-deterministic-queries";

export { buildDeterministicQueries } from "./templates/build-deterministic-queries";

type QueryAnalysisInput = { tickerId: string };

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
  const templatePack = config.templatePack!;

  const deterministic = buildDeterministicQueries(queryContext, {
    pack: templatePack,
  });

  // Zod applies defaults in `createAgentApp` before calling `run`.
  const queryCount = config.queryCount!;
  const allowedLanguages = config.allowedLanguages!;
  const minDeterministicCount = config.minDeterministicCount!;
  const weightBreaking = config.weightBreaking!;
  const weightKgChange = config.weightKgChange!;
  const weightFundamental = config.weightFundamental!;
  const openaiModel = config.openaiModel!;
  const maxTokens = config.maxTokens!;

  const systemContent = resolveQueryAnalysisSystemContent(
    config.prompts?.systemPrompt,
    {
      queryCount,
      allowedLanguages,
      minDeterministicCount,
      weights: {
        breaking: weightBreaking,
        kgChange: weightKgChange,
        fundamental: weightFundamental,
      },
    },
  );
  const userContent = resolveQueryAnalysisUserContent(
    config.prompts?.userPromptTemplate,
    queryContext,
  );

  const llmPromptFingerprint = computeLlmPromptFingerprint(
    systemContent,
    userContent,
  );

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
  return {
    success: true,
    details: { ...response, llmPromptFingerprint },
  };
};
