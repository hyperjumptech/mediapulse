import { createAgentDataApiClient } from "@workspace/agent-data-api-client";
import type { AgentRunContext, AgentRunResult } from "@workspace/agent-runtime";
import { env } from "@mediapulse/env/agents-content-generation";
import { logger } from "@workspace/logger";

import type { ContentGenerationConfig } from "./config-schema.js";
import { resolveContentGenerationConfig } from "./config-schema.js";
import { classifyLlmError } from "./llm-classify-error.js";
import {
  generateNewsletterWithLlm,
  type SourceForGeneration,
} from "./llm-generate-newsletter.js";
import type { AgentOutcome } from "./types/outcome.js";

type Input = { tickerId: string };

/**
 * Content-generation agent run function.
 *
 * Orchestrates the pipeline: fetch data sources → generate newsletter via
 * LLM (with retry) → persist to agent-data-api. Every exit path produces a
 * canonical {@link AgentOutcome} for diagnostics (MP-CGA-007).
 *
 * Note: Persist error handling (retry + classification) is deferred to MP-CGA-009.
 */
export async function run({
  input,
  config,
  token,
}: AgentRunContext<Input, ContentGenerationConfig>): Promise<AgentRunResult> {
  const resolvedConfig = resolveContentGenerationConfig(config);

  const dataApiClient = createAgentDataApiClient({
    baseUrl: env.AGENT_DATA_API_URL,
    version: "v1",
    token,
  });

  const { dataSources: sources } = await dataApiClient.contentGeneration.get({
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
    generated = await generateNewsletterWithLlm(sourcesForLlm, resolvedConfig);
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
  // Note: Retry + error classification deferred to MP-CGA-009.
  await dataApiClient.contentGeneration.create({
    subject: generated.subject,
    content: generated.content,
    ...(generated.description && {
      description: generated.description,
    }),
    tickerId: input.tickerId,
  });

  logger.info({ tickerId: input.tickerId }, "Stored newsletter for ticker");
  return { success: true };
}
