import { createAgentDataApiClient } from "@workspace/agent-data-api-client";
import type { AgentRunContext, AgentRunResult } from "@workspace/agent-runtime";
import { env } from "@mediapulse/env/agents-content-generation";
import { logger } from "@workspace/logger";

import type { ContentGenerationConfig } from "./config-schema.js";
import { resolveContentGenerationConfig } from "./config-schema.js";
import { classifyPersistError } from "./classify-persist-error.js";
import { classifyLlmError } from "./llm-classify-error.js";
import { computeFreshnessWindow } from "./freshness-window.js";
import {
  generateNewsletterWithLlm,
  type SourceForGeneration,
} from "./llm-generate-newsletter.js";
import type { AgentOutcome } from "./types/outcome.js";

type Input = { tickerId: string };

/**
 * Content-generation agent run function.
 *
 * Orchestrates the full pipeline: freshness precheck → fetch data sources → generate
 * newsletter via LLM (with retry) → persist to agent-data-api. Every exit path produces
 * a canonical {@link AgentOutcome} for diagnostics (MP-CGA-007).
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

  // -------------------------------------------------------------------------
  // Skip-if-fresh precheck (MP-CGA-006)
  // -------------------------------------------------------------------------
  // Freshness window formula:
  //   windowStart = start of the current calendar day in config.freshness.timezone (IANA)
  //   windowEnd   = start of the next calendar day in config.freshness.timezone
  //   Interval is half-open: [windowStart, windowEnd).
  //
  // **Deliberate divergence from source-selection (v1):**
  // The data-source selection window in `getDataSourcesForTicker` uses UTC start-of-day
  // (`scoredAt >= startOfTodayUtc`). This freshness window uses the configured IANA
  // timezone instead. These windows are intentionally different in v1. Aligning them
  // is deferred to a future phase.
  //
  // **Delivery-agent coordination:**
  // When this step is skipped, a new newsletter row is NOT written. The delivery agent
  // must be designed to either (a) locate and deliver the existing newsletter row, or
  // (b) skip its own delivery step when no new row appears.
  const timezone = resolvedConfig.freshness?.timezone ?? "Asia/Jakarta";
  const { windowStart, windowEnd } = computeFreshnessWindow(timezone);

  logger.info(
    {
      tickerId: input.tickerId,
      timezone,
      windowStart,
      windowEnd,
    },
    "Freshness precheck: computing window",
  );

  const precheckStart = Date.now();
  const freshnessResult =
    await dataApiClient.contentGenerationNewslettersLatest.get({
      tickerId: input.tickerId,
      windowStart,
      windowEnd,
    });
  const precheckDurationMs = Date.now() - precheckStart;

  if (precheckDurationMs > 100) {
    logger.warn(
      {
        tickerId: input.tickerId,
        precheckDurationMs,
      },
      "Freshness precheck took longer than 100ms",
    );
  }

  const existingNewsletterFound = freshnessResult.hasNewsletter;

  logger.info(
    {
      tickerId: input.tickerId,
      timezone,
      windowStart,
      windowEnd,
      existingNewsletterFound,
    },
    "Freshness precheck: result",
  );

  if (existingNewsletterFound) {
    const outcome: AgentOutcome = {
      outcome: "skipped_fresh_newsletter_exists",
      skipped: true,
      message: `Newsletter already generated for ${input.tickerId} today (skipped)`,
    };
    logger.info(
      { tickerId: input.tickerId, outcome },
      "Skipping run: fresh newsletter already exists",
    );
    return {
      success: false,
      message:
        outcome.message ??
        "Newsletter already generated for this ticker today (skipped)",
    };
  }

  // -------------------------------------------------------------------------
  // Fetch data sources
  // -------------------------------------------------------------------------
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
      message: `Failed to store generated newsletter: ${code}`,
    };
  }

  logger.info({ tickerId: input.tickerId }, "Stored newsletter for ticker");
  return { success: true };
}
