import { createAgentDataApiClient } from "@workspace/agent-data-api-client";
import type { AgentRunContext, AgentRunResult } from "@workspace/agent-runtime";
import { env } from "@mediapulse/env/agents-content-generation";
import { logger } from "@workspace/logger";

import { AGENT_VERSION } from "./agent-version.js";
import type { ContentGenerationConfig } from "./config-schema.js";
import {
  CONTENT_GENERATION_CONSTANTS,
  resolveContentGenerationConfig,
} from "./config-schema.js";
import type { RecentBullet } from "./lib/cross-run-dedup.js";
import { classifyPersistError } from "./classify-persist-error.js";
import { classifyLlmError } from "./llm-classify-error.js";
import { computeConfigVersion } from "./compute-config-version.js";
import { computePromptHash } from "./compute-prompt-hash.js";
import { computeFreshnessWindow } from "./freshness-window.js";
import {
  generateNewsletterWithLlm,
  groupSourcesBySection,
  type SourceForGeneration,
} from "./llm-generate-newsletter.js";
import {
  triageFetchRequests,
  type TriageCandidateSource,
} from "./triage-fetch-requests.js";
import {
  fetchSourceBodies,
  type FetchSourceBodiesResult,
  type RequestedFetchSource,
} from "./fetch-source-bodies.js";
import { selectSectionCoverageSeeds } from "./lib/section-coverage-seeds.js";
import { translateNewsletter } from "./translate-newsletter.js";
import type { TranslationTargetLanguage } from "./translate-newsletter.js";
import {
  narrativeGenerating,
  narrativeRunComplete,
  narrativeRunStart,
  type TickerSubject,
} from "./utilities/build-activity-narrative.js";
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
  /** Observability snapshot to persist on the success path (e.g. sectionFill). */
  details?: Record<string, unknown> | null;
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
    details = null,
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
      ...(details !== null ? { details } : {}),
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
  contract,
}: AgentRunContext<Input, ContentGenerationConfig>): Promise<AgentRunResult> {
  const runStart = Date.now();

  const resolvedConfig = resolveContentGenerationConfig(config);

  const dataApiClient = createAgentDataApiClient({
    baseUrl: env.AGENT_DATA_API_URL,
    version: "v1",
    token,
  });

  const report = (
    title: string,
    description?: string,
    status: "processing" | "completed" = "processing",
  ) => {
    const jobId = hermesCorrelation?.jobId;
    if (jobId && token) {
      void fetch(`${env.AGENT_REGISTRY_URL}/api/agent-activity`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: token },
        body: JSON.stringify({ jobId, title, description, status }),
      }).catch(() => {});
    }
  };

  // Pre-fetch reports only know the ticker id; the real symbol/name arrive with
  // the content-generation API response below.
  const fallbackSubject: TickerSubject = {
    symbol: input.tickerId,
    name: input.tickerId,
  };
  report(...narrativeRunStart(fallbackSubject));

  const pipelineRunId = hermesCorrelation?.pipelineStepId ?? null;
  const executionId = hermesCorrelation?.executionId ?? null;

  // -------------------------------------------------------------------------
  // Skip-if-duplicate precheck (MP-CGA-006)
  // -------------------------------------------------------------------------
  // Duplicate-guard window formula:
  //   windowStart = start of the current calendar day in config.duplicateGuard.timezone (IANA)
  //   windowEnd   = start of the next calendar day in config.duplicateGuard.timezone
  //   Interval is half-open: [windowStart, windowEnd).
  //
  // **Deliberate divergence from source-selection:**
  // The data-source selection window in `getDataSourcesForTicker` uses a rolling lookback
  // (`analyzedAt >= now - SOURCE_LOOKBACK_HOURS`). This duplicate-guard window uses the configured
  // IANA timezone calendar day instead. These windows are intentionally different.
  //
  // **Delivery-agent coordination:**
  // When this step is skipped, a new newsletter row is NOT written. The delivery agent
  // must be designed to either (a) locate and deliver the existing newsletter row, or
  // (b) skip its own delivery step when no new row appears.
  const timezone = resolvedConfig.duplicateGuard.timezone;
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
  report(
    "Checking for an existing newsletter",
    `newsletter window ${windowStart} to ${windowEnd}`,
  );
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
    report(
      ...narrativeRunComplete(fallbackSubject, {
        status: "skipped",
        itemsWritten: 0,
        sectionsFilled: 0,
        translationLanguages: [],
      }),
      "completed",
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
  const {
    dataSources: sources,
    tickerName,
    tickerSymbol,
    competitors,
    issuerAliases,
    subscriberLanguages,
  } = await dataApiClient.contentGeneration.get({
    tickerId: input.tickerId,
  });

  const subject: TickerSubject = {
    symbol: tickerSymbol,
    name: tickerName,
  };

  const { apiKey: _apiKey, ...safeModel } = resolvedConfig.model;
  const safeConfig = { ...resolvedConfig, model: safeModel };
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
    report(
      ...narrativeRunComplete(subject, {
        status: "failed",
        itemsWritten: 0,
        sectionsFilled: 0,
        translationLanguages: [],
        reason: `${subject.symbol} has no analyzed articles to write from yet.`,
      }),
      "completed",
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

  const triageCandidates: TriageCandidateSource[] = sources
    .filter((s) => !(typeof s.content === "string" && s.content.trim() !== ""))
    .map((s) => ({
      dataSourceId: s.dataSourceId,
      title: s.title,
      description: s.description ?? null,
      ...(typeof s.section === "string" ? { section: s.section } : {}),
      ...(typeof s.sectionScore === "number"
        ? { sectionScore: s.sectionScore }
        : {}),
    }));

  let fetchRequests: Awaited<ReturnType<typeof triageFetchRequests>> = [];
  if (triageCandidates.length > 0) {
    report(
      "Deciding which sources need a fetch",
      `${triageCandidates.length} candidate sources`,
    );
    try {
      fetchRequests = await triageFetchRequests(
        triageCandidates,
        resolvedConfig,
        { tickerId: input.tickerId, tickerName, tickerSymbol },
      );
    } catch (err) {
      logger.warn(
        { tickerId: input.tickerId, err },
        "Fetch triage failed; proceeding on descriptions alone",
      );
    }
  }

  const sourceById = new Map(sources.map((s) => [s.dataSourceId, s]));
  const requestedFetchSources: RequestedFetchSource[] = [];
  const requestedIds = new Set<string>();
  const pushFetchSource = (dataSourceId: string, reason: string) => {
    if (requestedIds.has(dataSourceId)) {
      return;
    }
    const source = sourceById.get(dataSourceId);
    if (!source) {
      return;
    }
    requestedIds.add(dataSourceId);
    requestedFetchSources.push({
      dataSourceId: source.dataSourceId,
      url: source.url,
      title: source.title,
      reason,
      ...(typeof source.sectionScore === "number"
        ? { sectionScore: source.sectionScore }
        : {}),
    });
  };

  // Guarantee the top candidate of every publishable section gets a body, so a section is never
  // dropped at grounding merely because the on-demand triage skipped its highest-scored article.
  for (const seed of selectSectionCoverageSeeds(
    sources,
    CONTENT_GENERATION_CONSTANTS.requireCitation.sections,
  )) {
    pushFetchSource(seed.dataSourceId, seed.reason);
  }

  for (const request of fetchRequests) {
    pushFetchSource(request.dataSourceId, request.reason);
  }

  let fetchResult: FetchSourceBodiesResult = {
    fetchedContentById: new Map(),
    droppedByGateIds: new Set(),
    counters: {
      requested: requestedFetchSources.length,
      droppedByCap: 0,
      droppedByDeadUrlCache: 0,
      attempted: 0,
      fetchSucceeded: 0,
      fetchFailed: 0,
      gateDropped: 0,
      persisted: 0,
    },
    fetchEvents: [],
  };
  if (requestedFetchSources.length > 0) {
    report(
      "Fetching full article bodies",
      `${requestedFetchSources.length} requested`,
    );
    try {
      fetchResult = await fetchSourceBodies(
        requestedFetchSources,
        resolvedConfig,
        { tickerId: input.tickerId, logger },
        {
          persistFetchedContent: (body) =>
            dataApiClient.contentGenerationFetchedContent.create(body),
          lookupDeadUrls: (body) =>
            dataApiClient.dataCollectionDeadUrlsLookup.create(body),
          recordDeadUrls: (body) =>
            dataApiClient.dataCollectionDeadUrlsRecord.create(body),
        },
      );
    } catch (err) {
      logger.error(
        { tickerId: input.tickerId, err },
        "On-demand fetch failed; proceeding on descriptions alone",
      );
    }
  }

  logger.info(
    { tickerId: input.tickerId, fetch: fetchResult.counters },
    "On-demand fetch summary",
  );

  if (fetchResult.fetchEvents.length > 0) {
    try {
      await dataApiClient.contentGenerationFetchEvents.create(
        fetchResult.fetchEvents.map((event) => ({
          dataSourceId: event.dataSourceId,
          tickerId: input.tickerId,
          reason: event.reason,
          ...(event.provider !== null ? { provider: event.provider } : {}),
          status: event.status,
        })),
      );
    } catch (err) {
      logger.error(
        { tickerId: input.tickerId, err },
        "Failed to record fetch events (best-effort, skipping)",
      );
    }
  }

  const mappedSources: SourceForGeneration[] = sources
    .filter((s) => !fetchResult.droppedByGateIds.has(s.dataSourceId))
    .map((s) => {
      const fetched = fetchResult.fetchedContentById.get(s.dataSourceId);
      const text = fetched?.content ?? s.content ?? s.description ?? "";
      return {
        dataSourceId: s.dataSourceId,
        url: s.url,
        title: s.title,
        content: text,
        ...(typeof s.author === "string" ? { author: s.author } : {}),
        ...(typeof s.source === "string" ? { source: s.source } : {}),
        ...(typeof s.publishedAt === "string"
          ? { publishedAt: s.publishedAt }
          : {}),
        ...(typeof s.section === "string" ? { section: s.section } : {}),
        ...(typeof s.sectionScore === "number"
          ? { sectionScore: s.sectionScore }
          : {}),
      };
    })
    .filter((entry) => entry.content.trim().length > 0);

  const sourcesForLlm = groupSourcesBySection(mappedSources);

  // Cross-day dedup corpus: recently published bullets steer the model away from repeats and
  // seed the post-generation drop. Best-effort — a fetch failure must not block generation.
  let recentBullets: RecentBullet[] = [];
  if (CONTENT_GENERATION_CONSTANTS.crossRunDedup.enabled) {
    try {
      const recent = await dataApiClient.contentGenerationBulletsRecent.get({
        tickerId: input.tickerId,
        days: CONTENT_GENERATION_CONSTANTS.crossRunDedup.windowDays,
      });
      recentBullets = recent.items.map((item) => ({
        sectionKey: item.sectionKey,
        bulletText: item.bulletText,
      }));
    } catch (err) {
      logger.warn(
        { tickerId: input.tickerId, err },
        "Cross-run dedup: failed to fetch recent bullets; proceeding without",
      );
    }
  }

  // Generate newsletter with retry-wrapped generateObject.
  let generated: Awaited<ReturnType<typeof generateNewsletterWithLlm>>;
  report(...narrativeGenerating(subject, sourcesForLlm.length));
  logger.info({ tickerId: input.tickerId }, "LLM generation: start");
  try {
    generated = await generateNewsletterWithLlm(sourcesForLlm, resolvedConfig, {
      tickerId: input.tickerId,
      date: new Date(runStart).toISOString().slice(0, 10),
      tickerName,
      tickerSymbol,
      competitors,
      issuerAliases,
      recentBullets,
      ...(contract !== undefined ? { brief: contract.brief } : {}),
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
    report(
      ...narrativeRunComplete(subject, {
        status: "failed",
        itemsWritten: 0,
        sectionsFilled: 0,
        translationLanguages: [],
        reason: `Newsletter generation failed: ${code}`,
      }),
      "completed",
    );
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
  const provenanceModel = resolvedConfig.model.model;

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
  report("Saving newsletter to database", "persisting English newsletter");
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

    const newsletterCitations = generated.newsletterCitations ?? [];
    if (persistedNewsletterId !== null && newsletterCitations.length > 0) {
      const newsletterId = persistedNewsletterId;
      try {
        await dataApiClient.contentGenerationCitations.create({
          newsletterId,
          citations: newsletterCitations.map((citation) => ({
            dataSourceId: citation.dataSourceId,
            sectionKey: citation.sectionKey,
          })),
        });
      } catch (citationErr) {
        logger.error(
          { tickerId: input.tickerId, newsletterId, err: citationErr },
          "Failed to record newsletter citations (best-effort, skipping)",
        );
      }
    }
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
    report(
      ...narrativeRunComplete(subject, {
        status: "failed",
        itemsWritten: 0,
        sectionsFilled: 0,
        translationLanguages: [],
        reason: `Failed to store generated newsletter: ${code}`,
      }),
      "completed",
    );
    return {
      success: false,
      message: `Failed to store generated newsletter: ${code}`,
    };
  }

  // -------------------------------------------------------------------------
  // Subscription-driven translation pass (best-effort)
  // -------------------------------------------------------------------------
  // Translate the persisted English newsletter into each non-English language that
  // an enabled subscriber has selected for this ticker (from the API response's
  // `subscriberLanguages`) and store it as a NewsletterTranslation keyed on the
  // canonical newsletter id. This is best-effort: a failure here must never fail
  // the run or roll back the English newsletter, because the delivery agent skips
  // non-English subscribers when no translation exists.
  const supportedTargetLanguages: TranslationTargetLanguage[] = ["id"];
  const targetLanguages = subscriberLanguages.filter(
    (language): language is TranslationTargetLanguage =>
      (supportedTargetLanguages as string[]).includes(language),
  );
  const unsupportedLanguages = subscriberLanguages.filter(
    (language) => !(supportedTargetLanguages as string[]).includes(language),
  );

  if (unsupportedLanguages.length > 0) {
    logger.warn(
      {
        tickerId: input.tickerId,
        unsupportedLanguages,
        event: "subscriber_language_unsupported",
      },
      "Subscriber language(s) have no translator; skipping",
    );
  }

  const translatedLanguages: string[] = [];
  if (persistedNewsletterId !== null && targetLanguages.length > 0) {
    const newsletterId = persistedNewsletterId;
    report("Translating newsletter", targetLanguages.join(", "));
    for (const targetLanguage of targetLanguages) {
      try {
        const translated = await translateNewsletter({
          subject: generated.subject,
          content: generated.content,
          targetLanguage,
          model: resolvedConfig.model.model,
          credentials: {
            openaiApiKey: resolvedConfig.model.apiKey,
            ...(resolvedConfig.model.baseUrl
              ? { baseUrl: resolvedConfig.model.baseUrl }
              : {}),
          },
        });
        await dataApiClient.newsletterTranslation.create({
          newsletterId,
          language: targetLanguage,
          subject: translated.subject,
          content: translated.content,
          model: resolvedConfig.model.model,
          ...(translated.promptTokens !== null
            ? { promptTokens: translated.promptTokens }
            : {}),
          ...(translated.completionTokens !== null
            ? { completionTokens: translated.completionTokens }
            : {}),
          ...(translated.totalTokens !== null
            ? { totalTokens: translated.totalTokens }
            : {}),
        });
        translatedLanguages.push(targetLanguage);
        logger.info(
          { tickerId: input.tickerId, newsletterId, language: targetLanguage },
          "Newsletter translation persisted",
        );
      } catch (translateErr) {
        logger.error(
          {
            tickerId: input.tickerId,
            newsletterId,
            language: targetLanguage,
            err: translateErr,
          },
          "Newsletter translation failed (best-effort, skipping)",
        );
      }
    }
  }

  // -------------------------------------------------------------------------
  // Success path
  // -------------------------------------------------------------------------
  logger.info({ tickerId: input.tickerId }, "Stored newsletter for ticker");

  const sectionFillEntries = Object.values(
    generated.sectionFillSnapshot?.bySection ?? {},
  );
  const itemsWritten = sectionFillEntries.reduce(
    (sum, entry) => sum + entry.citedBullets,
    0,
  );
  const sectionsFilled = sectionFillEntries.filter(
    (entry) => entry.citedBullets > 0,
  ).length;

  report(
    ...narrativeRunComplete(subject, {
      status: "success",
      itemsWritten,
      sectionsFilled,
      translationLanguages: translatedLanguages,
    }),
    "completed",
  );
  const groundingReportRows = (generated.citationGroundingReports ?? []).map(
    (report) => ({
      sectionKey: report.sectionKey,
      articleIndex: report.articleIndex,
      overlapScore: Math.round(report.overlapScore * 1000) / 1000,
      decision: report.decision.kind,
      ...(report.decision.kind !== "pass"
        ? { reason: report.decision.reason }
        : {}),
    }),
  );
  const successDetails: Record<string, unknown> = {
    fetch: fetchResult.counters,
    ...(generated.sectionFillSnapshot !== undefined
      ? {
          sectionFill: {
            bySection: generated.sectionFillSnapshot.bySection,
            sectionsRemoved: generated.sectionFillSnapshot.sectionsRemoved,
            ...(contract !== undefined
              ? { contractVersion: contract.version }
              : {}),
          },
        }
      : {}),
    grounding: {
      summary: generated.citationGroundingSummary,
      reports: groundingReportRows,
      ...(generated.requireCitationSummary !== undefined
        ? { requireCitation: generated.requireCitationSummary }
        : {}),
    },
    ...(generated.quickHitsDemotionRemoved !== undefined
      ? { quickHitsDemotionRemoved: generated.quickHitsDemotionRemoved }
      : {}),
    ...(generated.crossSectionEventDedupSummary !== undefined
      ? { crossSectionEventDedup: generated.crossSectionEventDedupSummary }
      : {}),
  };
  await writeDiagnostic({
    dataApiClient,
    tickerId: input.tickerId,
    agentOutcome: null,
    durationMs: Date.now() - runStart,
    newsletterId: persistedNewsletterId,
    pipelineRunId,
    executionId,
    details: successDetails,
  });
  return {
    success: true,
    details: {
      promptHash,
      fetch: fetchResult.counters,
      ...(generated.structuredReasoningTokens !== undefined
        ? { reasoningTokens: generated.structuredReasoningTokens }
        : {}),
      ...(generated.citationGroundingSummary !== undefined
        ? {
            grounding: {
              unlinked: generated.citationGroundingSummary.unlinked,
              dropped: generated.citationGroundingSummary.dropped,
              floorPreserved: generated.citationGroundingSummary.floorPreserved,
              p50Overlap: generated.citationGroundingSummary.p50Overlap,
            },
          }
        : {}),
      ...(generated.requireCitationSummary !== undefined
        ? {
            requireCitation: {
              sectionsRemoved: generated.requireCitationSummary.sectionsRemoved,
              bulletsRemovedUncited:
                generated.requireCitationSummary.bulletsRemovedUncited,
              bulletsRemovedDuplicate:
                generated.requireCitationSummary.bulletsRemovedDuplicate,
              sectionsKept: generated.requireCitationSummary.sectionsKept,
            },
          }
        : {}),
      ...(generated.sectionFillSnapshot !== undefined
        ? {
            sectionFill: {
              bySection: generated.sectionFillSnapshot.bySection,
              sectionsRemoved: generated.sectionFillSnapshot.sectionsRemoved,
              ...(contract !== undefined
                ? { contractVersion: contract.version }
                : {}),
            },
          }
        : {}),
    },
  };
}
