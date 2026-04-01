import { createAgentDataApiClient } from "@workspace/agent-data-api-client";
import type { AgentRunContext, AgentRunResult } from "@workspace/agent-runtime";
import { env } from "@mediapulse/env/agents-query-analysis";
import { logger } from "@workspace/logger";

import type { QueryCandidate } from "./deterministic-baseline.js";
import { buildDeterministicBaseline } from "./deterministic-baseline.js";
import { expandQueriesWithLlm } from "./llm-expand-queries.js";
import { mergeAndRankCandidates } from "./merge-query-candidates.js";
import type { QueryAnalysisConfig } from "./config-schema.js";
import type { QueryAnalysisInput } from "./input-schema.js";

/**
 * Runs daily query generation: load context, deterministic baseline, optional LLM expansion, merge, persist via agent-data-api.
 */
export const runQueryAnalysis = async (
  context: AgentRunContext<QueryAnalysisInput, QueryAnalysisConfig>,
): Promise<AgentRunResult> => {
  const { input, config, token, hermesCorrelation } = context;
  const log = logger.child({
    component: "query-analysis",
    tickerId: input.tickerId,
    ...(hermesCorrelation?.jobId
      ? { agentJobId: hermesCorrelation.jobId }
      : {}),
  });

  const dataApi = createAgentDataApiClient({
    baseUrl: env.AGENT_DATA_API_URL,
    version: "v1",
    token,
  });

  const ctx = await dataApi.queryAnalysis.get({ tickerId: input.tickerId });
  const baseline = buildDeterministicBaseline(ctx);
  let llmUsed = false;
  let llmFallback = false;
  let llmRows: QueryCandidate[] = [];

  const openaiKey = config.openaiApiKey?.trim();
  if (openaiKey) {
    try {
      const model =
        config.openaiModel ?? ctx.configSnapshot.model ?? "gpt-4o-mini";
      const maxTokens = ctx.configSnapshot.maxTokens ?? 1000;
      const extra = Math.max(
        1,
        ctx.configSnapshot.queryCount - baseline.length,
      );
      llmRows = await expandQueriesWithLlm(ctx, {
        openaiApiKey: openaiKey,
        model,
        maxTokens,
        extraCount: extra,
      });
      llmUsed = llmRows.length > 0;
    } catch (err) {
      llmFallback = true;
      log.warn(
        { err },
        "LLM query expansion failed; using deterministic set only",
      );
    }
  }

  const merged = mergeAndRankCandidates(baseline, llmRows, ctx.configSnapshot);

  const post = await dataApi.queryAnalysis.create({
    tickerId: input.tickerId,
    queries: merged,
    strategySnapshot: {
      configSnapshot: ctx.configSnapshot,
      llmUsed,
      llmFallback,
      baselineCount: baseline.length,
      llmCandidateCount: llmRows.length,
    },
    generationSource: "hybrid_v1",
    agentJobId: hermesCorrelation?.jobId ?? null,
    activate: true,
  });

  return {
    success: true,
    message: "Query set generated",
    details: {
      created: post.created,
      setId: post.setId,
      activeSetId: post.activeSetId,
      llmUsed,
      llmFallback,
    },
  };
};
