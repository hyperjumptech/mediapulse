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
import { describeLlmError } from "./describe-llm-error.js";
import { classifyLlmError } from "./llm-classify-error.js";
import { computeConfigVersion } from "./compute-config-version.js";
import { computePromptHash } from "./compute-prompt-hash.js";
import { computeFreshnessWindow } from "./freshness-window.js";
import {
  computeRenderedShape,
  computeShippableShape,
  isBelowShippableFloor,
} from "./shippable-shape.js";
import { readNewsletterDocument } from "@workspace/email-templates/newsletter-document";
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
import { citedFigures } from "./lib/figures-grounded.js";
import { selectSectionCoverageSeeds } from "./lib/section-coverage-seeds.js";
import { translateNewsletter } from "./translate-newsletter.js";
import type { TranslationTargetLanguage } from "./translate-newsletter.js";
import {
  narrativeFetching,
  narrativeGenerating,
  narrativeRunComplete,
  narrativeRunStart,
  narrativeSaving,
  narrativeSourcesLoaded,
  narrativeTranslating,
  narrativeTriage,
  type TickerSubject,
} from "./utilities/build-activity-narrative.js";
import { mapOutcomeToDiagnostic } from "./outcome-to-diagnostic.js";
import { sanitizeDiagnosticMessage } from "./sanitize-diagnostic-message.js";
import type { AgentOutcome } from "./types/outcome.js";

type Input = { tickerId: string; force?: boolean | undefined };

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
  /**
   * Safe, static human-readable context appended to the diagnostic message, such as the article
   * and section counts behind a skip. Never pass error objects, LLM output, or config values.
   */
  detail?: string | undefined;
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
    detail,
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
        ...(detail !== undefined ? { detail } : {}),
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

  // Resolved up front so every activity beat names the ticker rather than its id.
  // Best-effort: a lookup failure must not fail the run.
  let subject: TickerSubject = {
    symbol: input.tickerId,
    name: input.tickerId,
  };
  try {
    const tickerRecord = await dataApiClient.ticker.get({
      tickerId: input.tickerId,
    });
    subject = { symbol: tickerRecord.symbol, name: tickerRecord.name };
  } catch (err) {
    logger.warn(
      { tickerId: input.tickerId, err },
      "Failed to resolve ticker identity for activity narrative",
    );
  }

  report(...narrativeRunStart(subject));

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

  const existingNewsletterFound = freshnessResult.hasNewsletter && !input.force;
  const analyzedSinceCount = freshnessResult.analyzedSinceCount;
  const staleAnalysisDiscarded =
    existingNewsletterFound && analyzedSinceCount > 0;

  logger.info(
    {
      tickerId: input.tickerId,
      timezone,
      windowStart,
      windowEnd,
      existingNewsletterFound,
      newsletterCreatedAt: freshnessResult.newsletterCreatedAt,
      analyzedSinceCount,
      forced: input.force === true,
    },
    "Freshness precheck: result",
  );

  if (input.force === true && freshnessResult.hasNewsletter) {
    logger.warn(
      {
        tickerId: input.tickerId,
        newsletterId: freshnessResult.newsletterId,
        newsletterCreatedAt: freshnessResult.newsletterCreatedAt,
        event: "duplicate_guard_forced",
      },
      "Duplicate guard overridden by force: generating a second newsletter for today",
    );
  }

  if (staleAnalysisDiscarded) {
    logger.warn(
      {
        tickerId: input.tickerId,
        newsletterId: freshnessResult.newsletterId,
        newsletterCreatedAt: freshnessResult.newsletterCreatedAt,
        analyzedSinceCount,
        event: "fresh_newsletter_skip_discards_analysis",
      },
      `Skipping run: ${String(analyzedSinceCount)} section(s) classified after today's newsletter will not reach subscribers`,
    );
  }

  if (existingNewsletterFound) {
    const outcome: AgentOutcome = {
      outcome: staleAnalysisDiscarded
        ? "skipped_fresh_newsletter_stale_analysis"
        : "skipped_fresh_newsletter_exists",
      skipped: true,
      message: staleAnalysisDiscarded
        ? `Newsletter already generated for ${input.tickerId} today (skipped); ${String(analyzedSinceCount)} newer section(s) discarded`
        : `Newsletter already generated for ${input.tickerId} today (skipped)`,
    };
    logger.info(
      { tickerId: input.tickerId, outcome },
      "Skipping run: fresh newsletter already exists",
    );
    report(
      ...narrativeRunComplete(subject, {
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

  subject = { symbol: tickerSymbol, name: tickerName };
  report(...narrativeSourcesLoaded(subject, sources?.length ?? 0));

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
        status: "no_sources",
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
      message: outcome.message ?? "No data sources found for this ticker",
    };
  }

  const shippableShape = computeShippableShape(sources);
  if (
    isBelowShippableFloor(shippableShape, {
      minShippableArticles: CONTENT_GENERATION_CONSTANTS.minShippableArticles,
      minShippableSections: CONTENT_GENERATION_CONSTANTS.minShippableSections,
    })
  ) {
    const outcome: AgentOutcome = {
      outcome: "skipped_insufficient_sources",
      skipped: true,
      message: `Only ${String(shippableShape.articleCount)} article(s) across ${String(shippableShape.sectionCount)} section(s) would ship; skipped`,
    };
    logger.info(
      {
        tickerId: input.tickerId,
        ...shippableShape,
        sourceCount: sources.length,
        outcome,
        event: "insufficient_sources",
      },
      "Skipping run: too little would ship to make an issue",
    );
    report(
      ...narrativeRunComplete(subject, {
        status: "no_sources",
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
      detail: `${String(shippableShape.articleCount)} article(s) across ${String(shippableShape.sectionCount)} section(s) before generation`,
      details: {
        candidateArticleCount: shippableShape.articleCount,
        candidateSectionCount: shippableShape.sectionCount,
        sourceCount: sources.length,
      },
    });

    return {
      success: true,
      message: outcome.message ?? "Too little would ship; skipped",
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
    report(...narrativeTriage(subject, triageCandidates.length));
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
      ...(typeof source.publisherAuthority === "number"
        ? { publisherAuthority: source.publisherAuthority }
        : {}),
      citesFigure: citedFigures(source.description ?? "").length > 0,
    });
  };

  // Guarantee the top candidate of every publishable section gets a body, so a section is never
  // dropped merely because the on-demand triage skipped its highest-scored article.
  for (const seed of selectSectionCoverageSeeds(
    sources,
    CONTENT_GENERATION_CONSTANTS.coverageSeedSections,
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
    report(...narrativeFetching(subject, requestedFetchSources.length));
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
      const body = fetched?.content ?? s.content;
      const text = body ?? s.description ?? "";
      const contentIsDescriptionOnly =
        body === undefined || body === null || body.trim() === "";
      const publishedAt =
        typeof s.publishedAt === "string"
          ? s.publishedAt
          : fetched?.publishedAt;
      return {
        dataSourceId: s.dataSourceId,
        url: s.url,
        title: s.title,
        content: text,
        ...(typeof s.author === "string" ? { author: s.author } : {}),
        ...(typeof s.source === "string" ? { source: s.source } : {}),
        ...(typeof publishedAt === "string" ? { publishedAt } : {}),
        ...(typeof s.section === "string" ? { section: s.section } : {}),
        ...(typeof s.sectionScore === "number"
          ? { sectionScore: s.sectionScore }
          : {}),
        ...(typeof s.publisherAuthority === "number"
          ? { publisherAuthority: s.publisherAuthority }
          : {}),
        contentIsDescriptionOnly,
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
      details: { llmError: describeLlmError(err) },
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

  const renderedDocument = readNewsletterDocument(generated.content);
  const renderedShape =
    renderedDocument === undefined
      ? undefined
      : computeRenderedShape(renderedDocument);
  if (
    renderedShape !== undefined &&
    isBelowShippableFloor(renderedShape, {
      minShippableArticles: CONTENT_GENERATION_CONSTANTS.minShippableArticles,
      minShippableSections: CONTENT_GENERATION_CONSTANTS.minShippableSections,
    })
  ) {
    const outcome: AgentOutcome = {
      outcome: "skipped_nothing_survived_generation",
      skipped: true,
      message: `Only ${String(renderedShape.articleCount)} article(s) across ${String(renderedShape.sectionCount)} section(s) survived generation, down from ${String(shippableShape.articleCount)} across ${String(shippableShape.sectionCount)}; skipped`,
    };
    logger.info(
      {
        tickerId: input.tickerId,
        ...renderedShape,
        predictedArticleCount: shippableShape.articleCount,
        predictedSectionCount: shippableShape.sectionCount,
        outcome,
        event: "insufficient_rendered_articles",
      },
      "Skipping run: too little survived generation to make an issue",
    );
    report(
      ...narrativeRunComplete(subject, {
        status: "no_sources",
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
      detail: `${String(renderedShape.articleCount)} article(s) across ${String(renderedShape.sectionCount)} section(s) survived, down from ${String(shippableShape.articleCount)} across ${String(shippableShape.sectionCount)}`,
      details: {
        renderedArticleCount: renderedShape.articleCount,
        renderedSectionCount: renderedShape.sectionCount,
        candidateArticleCount: shippableShape.articleCount,
        candidateSectionCount: shippableShape.sectionCount,
      },
    });

    return {
      success: true,
      message: outcome.message ?? "Too little survived generation; skipped",
    };
  }

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
  report(...narrativeSaving(subject));
  logger.info({ tickerId: input.tickerId }, "Persisting newsletter: start");
  try {
    const persistResult = await dataApiClient.contentGeneration.create({
      subject: generated.subject,
      content: generated.content,
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

    const newsletterSections = generated.newsletterSections ?? [];
    if (persistedNewsletterId !== null && newsletterSections.length > 0) {
      const newsletterId = persistedNewsletterId;
      try {
        await dataApiClient.contentGenerationSections.create({
          newsletterId,
          sections: newsletterSections,
        });
      } catch (sectionErr) {
        logger.error(
          { tickerId: input.tickerId, newsletterId, err: sectionErr },
          "Failed to record newsletter sections (best-effort, skipping)",
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
    report(...narrativeTranslating(targetLanguages));
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
        if (translated.droppedPoints.length > 0) {
          logger.warn(
            {
              tickerId: input.tickerId,
              newsletterId,
              language: targetLanguage,
              dropped: translated.droppedPoints,
              event: "translated_point_rejected",
            },
            `Dropped ${String(translated.droppedPoints.length)} point(s) the translation pass broke`,
          );
        }
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
      articlesRead: fetchResult.counters.fetchSucceeded,
      repeatsDropped: generated.crossRunDedupSummary?.removedCount ?? 0,
      sectionsRemoved:
        generated.sectionFillSnapshot?.sectionsRemoved.length ?? 0,
    }),
    "completed",
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
    ...(generated.articlesSkippedSummaryFailed !== undefined
      ? { articlesSkippedSummaryFailed: generated.articlesSkippedSummaryFailed }
      : {}),
    ...(generated.summaryBackfill !== undefined
      ? { summaryBackfill: generated.summaryBackfill }
      : {}),
    ...(generated.crossRunDedupSummary !== undefined
      ? { crossRunDedup: generated.crossRunDedupSummary }
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
      ...(generated.articlesSkippedSummaryFailed !== undefined
        ? {
            articlesSkippedSummaryFailed:
              generated.articlesSkippedSummaryFailed,
          }
        : {}),
      ...(generated.summaryBackfill !== undefined
        ? { summaryBackfill: generated.summaryBackfill }
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
