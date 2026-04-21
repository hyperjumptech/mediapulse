import { createAgentDataApiClient } from "@workspace/agent-data-api-client";
import type { AgentRunContext, AgentRunResult } from "@workspace/agent-runtime";
import { env } from "@mediapulse/env/agents-content-generation";
import { logger } from "@workspace/logger";

import { AGENT_VERSION } from "./agent-version.js";
import type { ContentGenerationConfig } from "./config-schema.js";
import { resolveContentGenerationConfig } from "./config-schema.js";
import { classifyPersistError } from "./classify-persist-error.js";
import { classifyLlmError } from "./llm-classify-error.js";
import { computeFreshnessWindow } from "./freshness-window.js";
import {
  generateNewsletterWithLlm,
  type SourceForGeneration,
} from "./llm-generate-newsletter.js";
import { mapOutcomeToDiagnostic } from "./outcome-to-diagnostic.js";
import { sanitizeDiagnosticMessage } from "./sanitize-diagnostic-message.js";
import type { AgentOutcome } from "./types/outcome.js";

type Input = { tickerId: string };

/**
 * Parameters for the internal `writeDiagnostic` helper.
 */
type WriteDiagnosticParams = {
  /** Typed SDK client used to call `contentGenerationRuns.create`. */
  dataApiClient: ReturnType<typeof createAgentDataApiClient>;
  /** Ticker ID from the invocation input — forwarded to the diagnostic record. */
  tickerId: string;
  /**
   * Internal outcome for this run, or `null` when the run completed
   * successfully (success has no `OutcomeCode`).
   */
  agentOutcome: AgentOutcome | null;
  /** Wall-clock time from the start of `run()` to the diagnostic write, in milliseconds. */
  durationMs: number;
  /** ID of the persisted newsletter on the success path; `null` otherwise. */
  newsletterId?: string | null;
  /**
   * Hermes pipeline step id from the invoke context, forwarded as
   * `pipelineRunId` for cross-service correlation. `null` when not available.
   */
  pipelineRunId?: string | null;
};

/**
 * Writes a `ContentGenerationRun` diagnostic record to the agent-data-api.
 *
 * This is a **best-effort** write: any error thrown by the SDK is caught,
 * logged via `logger.error`, and swallowed. The primary `AgentRunResult`
 * returned to the caller is never mutated by a diagnostic write failure.
 *
 * Pass `agentOutcome: null` for the success path. Pass the actual
 * {@link AgentOutcome} for skip and failure paths so that `stage`,
 * `errorCode`, and `errorCategory` are derived from the outcome mapping.
 *
 * @param params - Diagnostic write parameters.
 */
async function writeDiagnostic(params: WriteDiagnosticParams): Promise<void> {
  const {
    dataApiClient,
    tickerId,
    agentOutcome,
    durationMs,
    newsletterId = null,
    pipelineRunId = null,
  } = params;

  const mapped = mapOutcomeToDiagnostic(agentOutcome);

  try {
    await dataApiClient.contentGenerationRuns.create({
      agentId: "content-generation",
      agentVersion: AGENT_VERSION,
      tickerId,
      outcome: mapped.outcome,
      stage: mapped.stage,
      errorCode: mapped.errorCode,
      errorCategory: mapped.errorCategory,
      message: sanitizeDiagnosticMessage({
        tickerId,
        outcomeCode: mapped.errorCode ?? undefined,
        stage: mapped.stage ?? undefined,
      }),
      durationMs,
      pipelineRunId,
      newsletterId,
    });
  } catch (diagErr) {
    logger.error(
      { err: diagErr, tickerId },
      "Failed to write diagnostic record",
    );
  }
}

/**
 * Content-generation agent run function.
 *
 * Orchestrates the full pipeline: freshness precheck → fetch data sources → generate
 * newsletter via LLM (with retry) → persist to agent-data-api. Every exit path produces
 * a canonical {@link AgentOutcome} for diagnostics (MP-CGA-007).
 *
 * A `ContentGenerationRun` diagnostic record is written to the agent-data-api on every
 * invocation (success, skip, or failure) before returning. Diagnostic write failures
 * are swallowed so they never affect the primary `AgentRunResult`.
 *
 * @param context - Agent run context containing input, config, token, and optional
 *   Hermes correlation ids.
 * @returns The Hermes-compatible `AgentRunResult` envelope.
 */
export async function run({
  input,
  config,
  token,
  hermesCorrelation,
}: AgentRunContext<Input, ContentGenerationConfig>): Promise<AgentRunResult> {
  const runStart = Date.now();

  const resolvedConfig = resolveContentGenerationConfig(config);

  const dataApiClient = createAgentDataApiClient({
    baseUrl: env.AGENT_DATA_API_URL,
    version: "v1",
    token,
  });

  const pipelineRunId = hermesCorrelation?.pipelineStepId ?? null;

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
    await writeDiagnostic({
      dataApiClient,
      tickerId: input.tickerId,
      agentOutcome: outcome,
      durationMs: Date.now() - runStart,
      pipelineRunId,
    });
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
    await writeDiagnostic({
      dataApiClient,
      tickerId: input.tickerId,
      agentOutcome: outcome,
      durationMs: Date.now() - runStart,
      pipelineRunId,
    });
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
  logger.info({ tickerId: input.tickerId }, "LLM generation: start");
  try {
    generated = await generateNewsletterWithLlm(sourcesForLlm, resolvedConfig);
  } catch (err) {
    const code = classifyLlmError(err);
    const outcome: AgentOutcome = { outcome: code, skipped: false };
    if (code === "validation_failed") {
      logger.warn(
        { tickerId: input.tickerId, outcome },
        "Validation outcome: LLM response failed schema validation",
      );
    }
    logger.error(
      { tickerId: input.tickerId, outcome, err },
      "LLM generation failed",
    );
    await writeDiagnostic({
      dataApiClient,
      tickerId: input.tickerId,
      agentOutcome: outcome,
      durationMs: Date.now() - runStart,
      pipelineRunId,
    });
    return {
      success: false,
      message: `Newsletter generation failed: ${code}`,
    };
  }

  logger.info({ tickerId: input.tickerId }, "LLM generation: complete");

  // Persist generated newsletter via agent-data-api.
  let persistedNewsletterId: string | null = null;
  logger.info({ tickerId: input.tickerId }, "Persisting newsletter: start");
  try {
    const persistResult = await dataApiClient.contentGeneration.create({
      subject: generated.subject,
      content: generated.content,
      ...(generated.description && {
        description: generated.description,
      }),
      tickerId: input.tickerId,
    });
    // Extract the newsletter id if the response includes one.
    persistedNewsletterId =
      "id" in persistResult && typeof persistResult.id === "string"
        ? persistResult.id
        : null;
  } catch (err) {
    const code = classifyPersistError(err);
    const outcome: AgentOutcome = { outcome: code, skipped: false };
    logger.error(
      { tickerId: input.tickerId, outcome, err },
      "Agent data API rejected newsletter store",
    );
    await writeDiagnostic({
      dataApiClient,
      tickerId: input.tickerId,
      agentOutcome: outcome,
      durationMs: Date.now() - runStart,
      pipelineRunId,
    });
    return {
      success: false,
      message: `Failed to store generated newsletter: ${code}`,
    };
  }

  // -------------------------------------------------------------------------
  // Success path
  // -------------------------------------------------------------------------
  logger.info({ tickerId: input.tickerId }, "Stored newsletter for ticker");
  await writeDiagnostic({
    dataApiClient,
    tickerId: input.tickerId,
    agentOutcome: null,
    durationMs: Date.now() - runStart,
    newsletterId: persistedNewsletterId,
    pipelineRunId,
  });
  return { success: true };
}
