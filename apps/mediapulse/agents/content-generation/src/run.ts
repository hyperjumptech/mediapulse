import { createAgentDataApiClient } from "@workspace/agent-data-api-client";
import type { AgentRunContext, AgentRunResult } from "@workspace/agent-runtime";
import { env } from "@mediapulse/env/agents-content-generation";
import { logger } from "@workspace/logger";

import { AGENT_VERSION } from "./agent-version.js";
import type { ContentGenerationConfig } from "./config-schema.js";
import { resolveContentGenerationConfig } from "./config-schema.js";
import { classifyPersistError } from "./classify-persist-error.js";
import { classifyLlmError } from "./llm-classify-error.js";
import { computeConfigVersion } from "./compute-config-version.js";
import { computePromptHash } from "./compute-prompt-hash.js";
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
  /**
   * Hermes execution id (`X-Execution-Id`) from the invoke context, forwarded
   * as `executionId` for per-request correlation. `null` when not available.
   */
  executionId?: string | null;
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
    executionId = null,
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
      executionId,
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
 * On the success path, seven provenance fields are computed and included in the
 * `contentGeneration.create(...)` call (MP-CGA-008):
 *   - `model`             — model string from resolved config.
 *   - `agentVersion`      — package-level constant (`AGENT_VERSION`).
 *   - `configVersion`     — SHA-256 hash of non-secret config fields.
 *   - `promptHash`        — SHA-256 hash of the exact system + user prompts.
 *   - `configSnapshotId`  — Hermes snapshot id if available, else `configVersion`.
 *   - `promptTokens`      — from `result.usage`; `null` when absent.
 *   - `completionTokens`  — from `result.usage`; `null` when absent.
 *   - `totalTokens`       — from `result.usage`; `null` when absent.
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
  const executionId = hermesCorrelation?.executionId ?? null;

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
      executionId,
    });
    return {
      success: true,
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

  const { apiKey: _apiKey, ...safeOpenai } = resolvedConfig.openai;
  const safeConfig = { ...resolvedConfig, openai: safeOpenai };
  logger.info({ sources }, "Data sources for ticker");
  logger.info({ config: safeConfig }, "Config");

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
      executionId,
    });
    return {
      success: true,
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
    generated = await generateNewsletterWithLlm(sourcesForLlm, resolvedConfig, {
      tickerId: input.tickerId,
      date: new Date(runStart).toISOString().slice(0, 10),
    });
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
      executionId,
    });
    return {
      success: false,
      message: `Newsletter generation failed: ${code}`,
    };
  }

  logger.info({ tickerId: input.tickerId }, "LLM generation: complete");

  // -------------------------------------------------------------------------
  // Compute provenance fields (MP-CGA-008)
  // -------------------------------------------------------------------------

  // `model`: read from the resolved config rather than the API response model
  // field. The config value reflects exactly what was requested, whereas the API
  // response model may be an alias or resolved variant (e.g. "gpt-4o-2024-08-06"
  // for an "gpt-4o" alias). Using the config value keeps provenance aligned with
  // the operator-visible setting in Hermes.
  const provenanceModel = resolvedConfig.openai.model;

  // `configVersion`: deterministic hash of non-secret config fields.
  const configVersion = computeConfigVersion(resolvedConfig);

  // `promptHash`: hash of the exact system + user prompt strings sent to the model.
  const promptHash = computePromptHash(
    generated.systemPrompt,
    generated.resolvedUserPrompt,
  );

  // `configSnapshotId`: use the Hermes-provided immutable snapshot id when
  // available in the invocation context. Currently the Hermes runtime does not
  // send a dedicated snapshot id header, so we always fall back to `configVersion`
  // (the deterministic hash of the validated config). If Hermes adds snapshot id
  // support in a future release, wire it here via `hermesCorrelation`.
  const configSnapshotId = configVersion;

  // Warn when token usage is absent so operators know counts are missing.
  if (generated.promptTokens === null) {
    logger.warn(
      { tickerId: input.tickerId },
      "Token usage absent from LLM response; storing null for token fields",
    );
  }

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
      // Provenance fields (MP-CGA-008)
      model: provenanceModel,
      agentVersion: AGENT_VERSION,
      configVersion,
      promptHash,
      configSnapshotId,
      promptTokens: generated.promptTokens ?? undefined,
      completionTokens: generated.completionTokens ?? undefined,
      totalTokens: generated.totalTokens ?? undefined,
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
      executionId,
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
    executionId,
  });
  return { success: true };
}
