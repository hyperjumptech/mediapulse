import { createAgentDataApiClient } from "@workspace/agent-data-api-client";
import type { AgentRunContext, AgentRunResult } from "@workspace/agent-runtime";
import { env } from "@mediapulse/env/agents-article-analysis";
import { logger } from "@workspace/logger";
import crypto from "node:crypto";

import {
  applyPerRunCaps,
  dedupeEntities,
  dedupeRelations,
} from "./analysis-caps-dedupe.js";
import {
  applyPerRunArticleEntityCap,
  buildArticleEntityPostChunks,
  buildNormalizedEntityCatalogFromProposals,
  canonicalizeArticleEntityRowsToRunEntities,
  dedupeArticleEntityMentions,
  filterArticleEntityRowsToRunCatalog,
  type ArticleEntityRow,
} from "./analysis-article-mentions.js";
import {
  canonicalizeEntityEvidenceRowsToRunEntities,
  canonicalizeRelationEvidenceRowsToRunEntities,
  dedupeEntityEvidence,
  dedupeRelationEvidence,
  filterEntityEvidenceRowsToRunCatalog,
  filterRelationEvidenceRowsToRunCatalog,
  type EntityEvidenceRow,
  type RelationEvidenceRow,
} from "./analysis-provenance.js";
import { buildArticleRelevancePostChunks } from "./analysis-relevance-post-chunks.js";
import {
  buildDraftRelevanceRow,
  validateRelevanceRowForPost,
  type ArticleRelevanceRow,
  type PerSourceRelevanceSignals,
} from "./analysis-relevance-scoring.js";
import {
  applyRelevanceSelection,
  applyRelevanceSelectionDiversified,
} from "./analysis-relevance-selection.js";
import {
  type EntityProposal,
  type RelationProposal,
} from "./analysis-vocabulary.js";
import {
  executeAnalysisCreateWithTransientRetries,
  toArticleAnalysisPostFailureRecord,
} from "./article-analysis-agent-data-api-post.js";
import {
  ARTICLE_ANALYSIS_RUN_SUMMARY_MESSAGE,
  ARTICLE_ANALYSIS_YIELD_REGRESSION_MESSAGE,
  ARTICLE_ANALYSIS_YIELD_SNAPSHOT_MESSAGE,
  aggregateRelevanceObservability,
  buildArticleAnalysisRunSummaryPayload,
  buildYieldSnapshotLogPayload,
  compareYieldAgainstBaseline,
  getRunYieldSnapshot,
  toSafeLogError,
  type ArticleAnalysisRunSummaryInput,
  type ChunkBuildParseCounts,
  type ExemplarsObservabilityAggregate,
  type LlmUsageTotals,
  type ExtractionRetryObservabilityAggregate,
  type YieldSnapshot,
} from "./article-analysis-observability.js";
import {
  deriveArticleAnalysisRunStatusLabel,
  isArticleAnalysisExtractionPolicyFailure,
  type ArticleAnalysisExtractionFailureRecord,
  type ArticleAnalysisPostFailureRecord,
} from "./article-analysis-run-policy.js";
import { buildAnalysisPostChunks } from "./build-analysis-post-chunks.js";
import {
  resolveArticleAnalysisConfig,
  toRelevanceWeightMapV1,
  type ArticleAnalysisConfig,
} from "./config-schema.js";
import type { ArticleAnalysisInput } from "./schemas/article-analysis-input-schema.js";
import {
  buildArticleAnalysisExtractionSystemContent,
  type LlmExtractionUsage,
} from "./llm-extract-entities.js";
import { DEFAULT_EXTRACTION_EXEMPLARS } from "./exemplars/default-extraction-exemplars.js";
import { resolveExemplarsForContext } from "./exemplars/resolve-extraction-exemplars.js";
import {
  buildAnalysisGetQuery,
  applyMaxBatchSizeCap,
  sortAnalysisDataSourcesByCreatedAt,
} from "./run-helpers.js";
import { hardDeleteDataSourceById } from "./extraction-failure-pruning.js";
import { normalizeEntityName } from "./normalize-entity-name.js";
import {
  accumulateTruncationMeta,
  createEmptyTruncationTotals,
  resolveTruncationTickerContext,
} from "./utilities/article-content-truncator.js";
import {
  createProcessOneSource,
  type SourceProcessingOutcome,
} from "./run-process-one-source.js";
import { runExtractionsInParallel } from "./utilities/parallel-extraction.js";
import {
  type HostTier,
  type SourceQualityComputeCtx,
} from "./utilities/source-quality.js";
import {
  createEmptyQualityCounters,
  type QualityDropReason,
} from "./utilities/content-quality-gate.js";
import {
  accumulateGroundingCounters,
  createEmptyGroundingTotals,
} from "./utilities/entity-grounding.js";

type ExistingEntity = {
  canonicalName: string;
  typeId: string;
  aliases: string[];
};

/**
 * Builds normalized lookup for existing canonical names and aliases.
 *
 * @param existingEntities - Entities returned by analysis GET.
 * @returns Normalized name/alias lookup for canonicalization.
 */
const buildExistingEntityLookup = (
  existingEntities: ReadonlyArray<ExistingEntity>,
): Map<string, ExistingEntity> => {
  const lookup = new Map<string, ExistingEntity>();
  const register = (rawName: string, entity: ExistingEntity) => {
    const normalized = normalizeEntityName(rawName);
    if (!lookup.has(normalized)) {
      lookup.set(normalized, entity);
    }
  };

  for (const entity of existingEntities) {
    register(entity.canonicalName, entity);
    for (const alias of entity.aliases) {
      register(alias, entity);
    }
  }

  return lookup;
};

/**
 * Canonicalizes extracted entities and relation endpoints using existing KG aliases/canonical names.
 *
 * @param entities - Extracted entities for one source.
 * @param relations - Extracted relations for one source.
 * @param existingLookup - Normalized lookup for existing entities.
 * @returns Canonicalized entities and relations.
 */
const resolveAgainstExistingEntities = (
  entities: readonly EntityProposal[],
  relations: readonly RelationProposal[],
  existingLookup: ReadonlyMap<string, ExistingEntity>,
): {
  entities: EntityProposal[];
  relations: RelationProposal[];
} => {
  const resolvedEntities = entities.map((entity) => {
    const directMatch = existingLookup.get(
      normalizeEntityName(entity.canonicalName),
    );
    const aliasMatch = entity.aliases
      .map((alias) => existingLookup.get(normalizeEntityName(alias)))
      .find((existing) => existing !== undefined);
    const match = directMatch ?? aliasMatch;

    if (!match) {
      return entity;
    }

    const aliases = new Set(entity.aliases);
    if (
      normalizeEntityName(entity.canonicalName) !==
      normalizeEntityName(match.canonicalName)
    ) {
      aliases.add(entity.canonicalName.trim());
    }

    return {
      ...entity,
      canonicalName: match.canonicalName,
      typeId: match.typeId,
      aliases: [...aliases],
    };
  });

  const resolveName = (name: string): string => {
    const resolved = existingLookup.get(normalizeEntityName(name));
    return resolved?.canonicalName ?? name;
  };

  const resolvedRelations = relations.map((relation) => ({
    ...relation,
    fromEntityName: resolveName(relation.fromEntityName),
    toEntityName: resolveName(relation.toEntityName),
  }));

  return {
    entities: resolvedEntities,
    relations: resolvedRelations,
  };
};

const sleepMs = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Minutes elapsed from an ISO 8601 instant to now (floating).
 *
 * @param iso - UTC instant from the analysis GET payload.
 * @returns Non-negative when `iso` is in the past.
 */
const minutesSinceUtcIso = (iso: string): number =>
  (Date.now() - new Date(iso).getTime()) / 60_000;

const emptyChunkParseCounts = (): ChunkBuildParseCounts => ({
  entityRelationChunkParseErrors: 0,
  articleEntityChunkParseErrors: 0,
  articleRelevanceChunkParseErrors: 0,
});

/**
 * Runs analysis: GET context, optional batch cap, LLM extraction per source,
 * vocabulary validation, caps, chunked POST of entities/relations, then chunked POST of
 * `articleEntities` (after ER commits), then chunked `articleRelevances` with canonical
 * `scoreBreakdown`, weighted `score`, and configurable `selected` (UTC-day budget from GET).
 *
 * Partial failure (MP-ART-ANALYSIS-007): optional `runPolicy` rejects the run when too few
 * sources extract successfully; vocabulary/LLM failures per source are recorded and skipped;
 * POST failures stop later phases and only API-confirmed counts are aggregated.
 * Successful extractions are canonicalized against existing KG entities (mainline behavior).
 *
 * Observability (MP-ART-ANALYSIS-008): structured run summary log (`article_analysis.run.summary`)
 * with per-stage counters, optional LLM usage, and safe error fields (no raw `Error` objects).
 *
 * @param context - Hermes input/config and bearer token.
 * @returns Aggregated success with POST tallies or structured failure.
 */
export const run = async ({
  input,
  config,
  token,
  hermesCorrelation,
}: AgentRunContext<
  ArticleAnalysisInput,
  ArticleAnalysisConfig
>): Promise<AgentRunResult> => {
  const cfg = resolveArticleAnalysisConfig(config);
  const runId = crypto.randomUUID();
  const runStart = Date.now();

  const log = logger.child({
    component: "article-analysis",
    runId,
    tickerId: input.tickerId,
    ...(hermesCorrelation?.jobId ? { jobId: hermesCorrelation.jobId } : {}),
    ...(hermesCorrelation?.executionId
      ? { executionId: hermesCorrelation.executionId }
      : {}),
    ...(hermesCorrelation?.scheduleId
      ? { scheduleId: hermesCorrelation.scheduleId }
      : {}),
    ...(hermesCorrelation?.scheduleExecutionId
      ? { scheduleExecutionId: hermesCorrelation.scheduleExecutionId }
      : {}),
    ...(hermesCorrelation?.pipelineStepId
      ? { pipelineStepId: hermesCorrelation.pipelineStepId }
      : {}),
  });

  const mergeRunSummaryInput = (
    summary: ArticleAnalysisRunSummaryInput,
  ): ArticleAnalysisRunSummaryInput => ({
    ...summary,
    perSourceLatency: summary.perSourceLatency ?? {
      extractionMs: perSourceExtractionLatencyMs,
      brainstormMs: perSourceBrainstormLatencyMs,
      critiqueMs: perSourceCritiqueLatencyMs,
    },
    droppedByContentQuality: summary.droppedByContentQuality ?? {
      ...droppedByContentQuality,
    },
    truncation:
      summary.truncation ??
      (truncationTotals.paragraphsKept > 0 ||
      truncationTotals.paragraphsDropped > 0 ||
      truncationTotals.leadCharsKept > 0 ||
      truncationTotals.tickerSentencesKept > 0
        ? {
            leadCharsKept: truncationTotals.leadCharsKept,
            tickerSentencesKept: truncationTotals.tickerSentencesKept,
            paragraphsKept: truncationTotals.paragraphsKept,
            paragraphsDropped: truncationTotals.paragraphsDropped,
          }
        : undefined),
    exemplars: summary.exemplars ?? exemplarsObservability ?? undefined,
    grounding:
      summary.grounding ??
      (groundingTotals.entitiesUngroundedTotal > 0 ||
      groundingTotals.relationsDroppedTotal > 0 ||
      groundingTotals.mentionsDroppedTotal > 0
        ? {
            entitiesUngroundedTotal: groundingTotals.entitiesUngroundedTotal,
            relationsDroppedTotal: groundingTotals.relationsDroppedTotal,
            mentionsDroppedTotal: groundingTotals.mentionsDroppedTotal,
          }
        : undefined),
    relationCritique:
      summary.relationCritique ??
      (relationsCritiquedSources > 0 ||
      relationsDroppedByCritique > 0 ||
      relationsCritiqueSkippedDueToDeadline > 0 ||
      relationCritiqueCalls > 0
        ? {
            sourcesCritiqued: relationsCritiquedSources,
            relationsDroppedByCritique,
            critiqueCalls: relationCritiqueCalls,
            critiquePromptTokens: llmUsageTotals.critiquePromptTokens,
            critiqueCompletionTokens: llmUsageTotals.critiqueCompletionTokens,
          }
        : undefined),
    vocabularyPartitioning:
      summary.vocabularyPartitioning ??
      (badEntitiesDropped > 0 ||
      badRelationsDropped > 0 ||
      vocabularyRepairCallsAttempted > 0 ||
      rowsRecoveredByRepair > 0
        ? {
            badEntitiesDropped,
            badRelationsDropped,
            repairCallsAttempted: vocabularyRepairCallsAttempted,
            repairCallsSucceeded: vocabularyRepairCallsSucceeded,
            repairCallsFailed: vocabularyRepairCallsFailed,
            rowsRecoveredByRepair,
          }
        : undefined),
    sourceQuality:
      summary.sourceQuality ??
      (sourceQualityScoredSourceCount > 0
        ? {
            tier1Sources: sourceQualityTier1Sources,
            tier2Sources: sourceQualityTier2Sources,
            tier3Sources: sourceQualityTier3Sources,
            unknownHostSources: sourceQualityUnknownHostSources,
            avgRecencyHours:
              sourceQualityRecencyHoursCount > 0
                ? sourceQualityRecencyHoursSum / sourceQualityRecencyHoursCount
                : null,
            avgQualityScore:
              sourceQualityScoreSum / sourceQualityScoredSourceCount,
          }
        : undefined),
    selection:
      summary.selection ??
      (selectionEligibleRows > 0 ||
      selectionSuppressedAsDuplicates > 0 ||
      selectionClustersFormed > 0
        ? {
            eligibleRows: selectionEligibleRows,
            clustersFormed: selectionClustersFormed,
            selectedAfterDiversification: selectionSelectedAfterDiversification,
            suppressedAsDuplicates: selectionSuppressedAsDuplicates,
            largestClusterSize: selectionLargestClusterSize,
          }
        : undefined),
    parallelism:
      summary.parallelism ??
      (cfg.extractionConcurrency > 1 ||
      extractionSkippedDueToDeadline > 0 ||
      parallelPeakInFlight > 0
        ? {
            concurrency: cfg.extractionConcurrency,
            peakInFlight: parallelPeakInFlight,
            extractionSkippedDueToDeadline,
            ...(parallelDeadlineFiredAtMs !== undefined
              ? { deadlineFiredAtMs: parallelDeadlineFiredAtMs }
              : {}),
          }
        : undefined),
    extractionRetries:
      summary.extractionRetries ??
      (extractionRetriesSourcesRetried > 0
        ? ({
            sourcesRetried: extractionRetriesSourcesRetried,
            totalRetryAttempts: extractionRetriesTotalAttempts,
            recoveredByRetry: extractionRetriesRecoveredByRetry,
            exhausted: extractionRetriesExhausted,
          } satisfies ExtractionRetryObservabilityAggregate)
        : undefined),
    extractionCallTimeouts:
      summary.extractionCallTimeouts ??
      (extractionCallTimeoutsTotal > 0
        ? extractionCallTimeoutsTotal
        : undefined),
  });

  /**
   * Emits run summary and yield snapshot logs; returns snapshot for agent details.
   *
   * @param summary - Partial run summary; missing counters are filled from run scope.
   * @returns Yield snapshot derived from the merged summary input.
   */
  const emitRunSummaryAndYield = (
    summary: ArticleAnalysisRunSummaryInput,
  ): YieldSnapshot => {
    const merged = mergeRunSummaryInput(summary);
    log.info(
      buildArticleAnalysisRunSummaryPayload(merged),
      ARTICLE_ANALYSIS_RUN_SUMMARY_MESSAGE,
    );
    const yieldSnapshot = getRunYieldSnapshot(merged);
    log.info(
      buildYieldSnapshotLogPayload(yieldSnapshot),
      ARTICLE_ANALYSIS_YIELD_SNAPSHOT_MESSAGE,
    );
    const comparison = compareYieldAgainstBaseline(
      yieldSnapshot,
      cfg.yieldBaseline,
    );
    if (comparison.regression && comparison.deltas !== null) {
      log.warn(
        {
          baseline: comparison.baseline,
          ...comparison.deltas,
        },
        ARTICLE_ANALYSIS_YIELD_REGRESSION_MESSAGE,
      );
    }
    return yieldSnapshot;
  };

  const sourceQualityHostTiers: SourceQualityComputeCtx["hostTiers"] = {
    ...(cfg.sourceQualityHostTier1 !== undefined
      ? { tier1: cfg.sourceQualityHostTier1 }
      : {}),
    ...(cfg.sourceQualityHostTier2 !== undefined
      ? { tier2: cfg.sourceQualityHostTier2 }
      : {}),
    ...(cfg.sourceQualityHostTier3 !== undefined
      ? { tier3: cfg.sourceQualityHostTier3 }
      : {}),
  };

  const recordSourceQualityTier = (tier: HostTier): void => {
    if (tier === "tier1") {
      sourceQualityTier1Sources += 1;
    } else if (tier === "tier2") {
      sourceQualityTier2Sources += 1;
    } else if (tier === "tier3") {
      sourceQualityTier3Sources += 1;
    } else {
      sourceQualityUnknownHostSources += 1;
    }
  };

  if (cfg.verbose) {
    log.info(
      {
        openaiModel: cfg.openaiModel,
        maxContentChars: cfg.maxContentChars,
      },
      "article-analysis run started",
    );
  }

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

  report("Fetching articles to analyse", `ticker ${input.tickerId}`);

  let articlesProcessedForSummary = 0;
  const chunkParseCounts = emptyChunkParseCounts();
  let relevanceRowValidationFailures = 0;
  const llmUsageTotals: LlmUsageTotals = {
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
    brainstormCalls: 0,
    brainstormPromptTokens: 0,
    brainstormCompletionTokens: 0,
    critiqueCalls: 0,
    critiquePromptTokens: 0,
    critiqueCompletionTokens: 0,
  };
  let llmUsageAccumulated = false;
  let extractionLatencyMsTotal = 0;
  let extractionCalls = 0;
  let brainstormCalls = 0;
  let relationsCritiquedSources = 0;
  let relationsCritiqueSkippedDueToDeadline = 0;
  let relationsDroppedByCritique = 0;
  let relationCritiqueCalls = 0;
  let badEntitiesDropped = 0;
  let badRelationsDropped = 0;
  let vocabularyRepairCallsAttempted = 0;
  let vocabularyRepairCallsSucceeded = 0;
  let vocabularyRepairCallsFailed = 0;
  let vocabularyRepairFailures = 0;
  let rowsRecoveredByRepair = 0;
  let sourceQualityTier1Sources = 0;
  let sourceQualityTier2Sources = 0;
  let sourceQualityTier3Sources = 0;
  let sourceQualityUnknownHostSources = 0;
  let sourceQualityRecencyHoursSum = 0;
  let sourceQualityRecencyHoursCount = 0;
  let sourceQualityScoreSum = 0;
  let sourceQualityScoredSourceCount = 0;
  let selectionEligibleRows = 0;
  let selectionClustersFormed = 0;
  let selectionSelectedAfterDiversification = 0;
  let selectionSuppressedAsDuplicates = 0;
  let selectionLargestClusterSize = 0;
  let lastLlmPromptFingerprint: string | undefined;
  let relevanceRowsForObservability: ArticleRelevanceRow[] | null = null;
  let exemplarsObservability: ExemplarsObservabilityAggregate | null = null;
  const extractionFailures: ArticleAnalysisExtractionFailureRecord[] = [];
  const droppedByContentQuality = createEmptyQualityCounters();
  const truncationTotals = createEmptyTruncationTotals();
  const groundingTotals = createEmptyGroundingTotals();
  let extractionSuccessCount = 0;
  const postFailures: ArticleAnalysisPostFailureRecord[] = [];
  let entitiesCreated = 0;
  let entitiesReused = 0;
  let relationsCreated = 0;
  let articlesScoredTotal = 0;
  let articlesSelectedTotal = 0;
  let extractionSkippedDueToDeadline = 0;
  let extractionRetriesSourcesRetried = 0;
  let extractionRetriesTotalAttempts = 0;
  let extractionRetriesRecoveredByRetry = 0;
  let extractionRetriesExhausted = 0;
  let extractionCallTimeoutsTotal = 0;
  let parallelPeakInFlight = 0;
  let parallelDeadlineFiredAtMs: number | undefined;
  const perSourceExtractionLatencyMs: number[] = [];
  const perSourceBrainstormLatencyMs: number[] = [];
  const perSourceCritiqueLatencyMs: number[] = [];

  const accumulateLlmUsage = (usage: LlmExtractionUsage | null): void => {
    if (!usage) {
      return;
    }
    llmUsageAccumulated = true;
    llmUsageTotals.promptTokens += usage.inputTokens;
    llmUsageTotals.completionTokens += usage.outputTokens;
    llmUsageTotals.totalTokens += usage.totalTokens;
  };

  const accumulateBrainstormUsage = (
    usage: LlmExtractionUsage | null,
  ): void => {
    if (!usage) {
      return;
    }
    llmUsageAccumulated = true;
    llmUsageTotals.brainstormCalls += 1;
    llmUsageTotals.brainstormPromptTokens += usage.inputTokens;
    llmUsageTotals.brainstormCompletionTokens += usage.outputTokens;
  };

  const accumulateCritiqueUsage = (usage: LlmExtractionUsage | null): void => {
    if (!usage) {
      return;
    }
    llmUsageAccumulated = true;
    llmUsageTotals.critiqueCalls += 1;
    llmUsageTotals.critiquePromptTokens += usage.inputTokens;
    llmUsageTotals.critiqueCompletionTokens += usage.outputTokens;
  };

  try {
    const effectiveMaxBatchSize = cfg.maxBatchSize;
    const analysisGetLimit = Math.min(
      effectiveMaxBatchSize,
      cfg.analysisGetDataSourceLimitMax,
    );
    const query = buildAnalysisGetQuery(input.tickerId, {
      limit: analysisGetLimit,
    });
    const ctx = await dataApiClient.analysis.get(query);

    const unanalyzedBacklogTotal = ctx.dataSourceTotalCount;
    if (
      unanalyzedBacklogTotal > 0 &&
      cfg.debounceMinUnanalyzedCount > 0 &&
      unanalyzedBacklogTotal < cfg.debounceMinUnanalyzedCount
    ) {
      const yieldSnapshot = emitRunSummaryAndYield({
        outcome: "success",
        articlesProcessed: 0,
        extractionSuccessCount: 0,
        extractionFailures: [],
        relevanceRowValidationFailures: 0,
        chunkParseCounts: emptyChunkParseCounts(),
        postFailures: [],
        entitiesCreated: 0,
        entitiesReused: 0,
        relationsCreated: 0,
        articlesScored: 0,
        articlesSelected: 0,
        relevanceAggregate: null,
        llmUsage: null,
        extractionLatencyMsTotal: 0,
        extractionCalls: 0,
        runStatusLabel: "success",
        semanticFailureReason: "debounce_min_unanalyzed_count",
      });
      report(
        "Run debounced",
        `${unanalyzedBacklogTotal} articles below min ${cfg.debounceMinUnanalyzedCount}`,
        "completed",
      );
      return {
        success: true,
        message: `debounce: ${unanalyzedBacklogTotal} unanalyzed source(s) below min ${cfg.debounceMinUnanalyzedCount}; skipping run`,
        details: {
          yieldSnapshot,
          dataSourcesReturned: unanalyzedBacklogTotal,
          dataSourcesSelected: 0,
          runStatus: "success" as const,
          extractionFailures: [] as ArticleAnalysisExtractionFailureRecord[],
          extractionSuccessCount: 0,
          postFailures: [] as ArticleAnalysisPostFailureRecord[],
          entitiesCreated: 0,
          entitiesReused: 0,
          relationsCreated: 0,
          postChunks: 0,
          articleEntityRowsPosted: 0,
          mentionPostChunks: 0,
          articlesScored: 0,
          articlesSelected: 0,
          relevancePostChunks: 0,
        },
      };
    }

    if (
      unanalyzedBacklogTotal > 0 &&
      cfg.debounceMinMinutesSinceLastScore > 0 &&
      ctx.lastRelevanceScoredAtIso !== null &&
      minutesSinceUtcIso(ctx.lastRelevanceScoredAtIso) <
        cfg.debounceMinMinutesSinceLastScore
    ) {
      const yieldSnapshot = emitRunSummaryAndYield({
        outcome: "success",
        articlesProcessed: 0,
        extractionSuccessCount: 0,
        extractionFailures: [],
        relevanceRowValidationFailures: 0,
        chunkParseCounts: emptyChunkParseCounts(),
        postFailures: [],
        entitiesCreated: 0,
        entitiesReused: 0,
        relationsCreated: 0,
        articlesScored: 0,
        articlesSelected: 0,
        relevanceAggregate: null,
        llmUsage: null,
        extractionLatencyMsTotal: 0,
        extractionCalls: 0,
        runStatusLabel: "success",
        semanticFailureReason: "debounce_min_minutes_since_last_score",
      });
      report(
        "Run debounced",
        `last scored within ${cfg.debounceMinMinutesSinceLastScore}min`,
        "completed",
      );
      return {
        success: true,
        message: `debounce: last relevance scored at ${ctx.lastRelevanceScoredAtIso} is within ${cfg.debounceMinMinutesSinceLastScore} minute(s); skipping run`,
        details: {
          yieldSnapshot,
          dataSourcesReturned: unanalyzedBacklogTotal,
          dataSourcesSelected: 0,
          runStatus: "success" as const,
          extractionFailures: [] as ArticleAnalysisExtractionFailureRecord[],
          extractionSuccessCount: 0,
          postFailures: [] as ArticleAnalysisPostFailureRecord[],
          entitiesCreated: 0,
          entitiesReused: 0,
          relationsCreated: 0,
          postChunks: 0,
          articleEntityRowsPosted: 0,
          mentionPostChunks: 0,
          articlesScored: 0,
          articlesSelected: 0,
          relevancePostChunks: 0,
        },
      };
    }

    const sorted = sortAnalysisDataSourcesByCreatedAt(ctx.dataSources);
    const batch = applyMaxBatchSizeCap(sorted, effectiveMaxBatchSize);
    articlesProcessedForSummary = batch.length;

    report(
      "Loaded article batch",
      `${batch.length} sources\n${batch.map((s) => s.url).join("\n")}`,
    );

    if (batch.length === 0) {
      const yieldSnapshot = emitRunSummaryAndYield({
        outcome: "success",
        articlesProcessed: 0,
        extractionSuccessCount: 0,
        extractionFailures: [],
        relevanceRowValidationFailures: 0,
        chunkParseCounts: emptyChunkParseCounts(),
        postFailures: [],
        entitiesCreated: 0,
        entitiesReused: 0,
        relationsCreated: 0,
        articlesScored: 0,
        articlesSelected: 0,
        relevanceAggregate: null,
        llmUsage: null,
        extractionLatencyMsTotal: 0,
        extractionCalls: 0,
        runStatusLabel: "success",
      });
      report(
        "No articles to process",
        "analysis context returned 0 sources",
        "completed",
      );
      return {
        success: true,
        message: "analysis context loaded (0 source(s)); nothing to process",
        details: {
          yieldSnapshot,
          dataSourcesReturned: ctx.dataSourceTotalCount,
          dataSourcesSelected: 0,
          runStatus: "success" as const,
          extractionFailures: [] as ArticleAnalysisExtractionFailureRecord[],
          extractionSuccessCount: 0,
          postFailures: [] as ArticleAnalysisPostFailureRecord[],
          entitiesCreated: 0,
          entitiesReused: 0,
          relationsCreated: 0,
          postChunks: 0,
          articleEntityRowsPosted: 0,
          mentionPostChunks: 0,
          articlesScored: 0,
          articlesSelected: 0,
          relevancePostChunks: 0,
          vocabularyFailures: 0,
        },
      };
    }

    if (ctx.entityTypes.length === 0 || ctx.relationTypes.length === 0) {
      const yieldSnapshot = emitRunSummaryAndYield({
        outcome: "failure",
        articlesProcessed: batch.length,
        extractionSuccessCount: 0,
        extractionFailures: [],
        relevanceRowValidationFailures: 0,
        chunkParseCounts: emptyChunkParseCounts(),
        postFailures: [],
        entitiesCreated: 0,
        entitiesReused: 0,
        relationsCreated: 0,
        articlesScored: 0,
        articlesSelected: 0,
        relevanceAggregate: null,
        llmUsage: null,
        extractionLatencyMsTotal: 0,
        extractionCalls: 0,
        semanticFailureReason: "empty_kg_vocabulary",
      });
      report(
        "KG vocabulary not configured",
        `${ctx.entityTypes.length} entity types, ${ctx.relationTypes.length} relation types`,
        "completed",
      );
      return {
        success: false,
        message:
          "KG vocabulary from analysis GET is empty (entityTypes or relationTypes); cannot extract",
        details: {
          yieldSnapshot,
          entityTypeCount: ctx.entityTypes.length,
          relationTypeCount: ctx.relationTypes.length,
          articlesScored: 0,
          articlesSelected: 0,
          relevancePostChunks: 0,
        },
      };
    }

    const systemContent = buildArticleAnalysisExtractionSystemContent(ctx);
    const resolvedExemplars = resolveExemplarsForContext(
      DEFAULT_EXTRACTION_EXEMPLARS,
      ctx,
      cfg.fewShotExemplarCount,
      cfg.fewShotExemplarArchetypes,
    );
    exemplarsObservability = {
      requestedCount: cfg.fewShotExemplarCount,
      resolvedCount: resolvedExemplars.length,
      appliedArchetypes: resolvedExemplars.map(
        (exemplar) => exemplar.archetype,
      ),
    };
    const existingLookup = buildExistingEntityLookup(ctx.existingEntities);

    const mergedEntities: EntityProposal[] = [];
    const mergedRelations: RelationProposal[] = [];
    const mergedArticleEntityRows: ArticleEntityRow[] = [];
    const mergedEntityEvidence: EntityEvidenceRow[] = [];
    const mergedRelationEvidence: RelationEvidenceRow[] = [];
    const perSourceSignals: PerSourceRelevanceSignals[] = [];
    let vocabularyFailures = 0;

    const truncationTickerContext = resolveTruncationTickerContext(
      ctx.entityTypes,
      ctx.existingEntities,
    );
    const isRunDeadlineElapsed = (): boolean =>
      cfg.runDeadlineMs !== undefined &&
      Date.now() - runStart >= cfg.runDeadlineMs;

    const applySourceProcessingOutcome = (
      outcome: SourceProcessingOutcome,
    ): void => {
      mergedEntities.push(...outcome.mergedEntities);
      mergedRelations.push(...outcome.mergedRelations);
      mergedArticleEntityRows.push(...outcome.mergedArticleEntityRows);
      mergedEntityEvidence.push(...outcome.mergedEntityEvidence);
      mergedRelationEvidence.push(...outcome.mergedRelationEvidence);
      if (outcome.perSourceSignal !== undefined) {
        perSourceSignals.push(outcome.perSourceSignal);
      }
      extractionFailures.push(...outcome.extractionFailures);
      for (const [reason, count] of Object.entries(
        outcome.droppedByContentQualityDelta,
      )) {
        if (count !== undefined && count > 0) {
          droppedByContentQuality[reason as QualityDropReason] += count;
        }
      }
      if (outcome.truncationMeta !== undefined) {
        accumulateTruncationMeta(truncationTotals, outcome.truncationMeta);
      }
      if (outcome.groundingCounters !== undefined) {
        accumulateGroundingCounters(groundingTotals, outcome.groundingCounters);
      }
      if (outcome.llmPromptFingerprint !== undefined) {
        lastLlmPromptFingerprint = outcome.llmPromptFingerprint;
      }
      if (outcome.extractionUsage !== undefined) {
        accumulateLlmUsage(outcome.extractionUsage);
      }
      if (outcome.repairUsage !== undefined) {
        accumulateLlmUsage(outcome.repairUsage);
      }
      if (outcome.brainstormUsage !== undefined) {
        accumulateBrainstormUsage(outcome.brainstormUsage);
      }
      if (outcome.critiqueUsage !== undefined) {
        accumulateCritiqueUsage(outcome.critiqueUsage);
      }
      extractionLatencyMsTotal += outcome.extractionLatencyMs;
      extractionCalls += outcome.extractionCalls;
      if (outcome.extractionCalls > 0) {
        perSourceExtractionLatencyMs.push(outcome.extractionLatencyMs);
      }
      if (outcome.brainstormCalls > 0) {
        perSourceBrainstormLatencyMs.push(outcome.brainstormLatencyMs);
      }
      if (outcome.relationCritiqueCalls > 0) {
        perSourceCritiqueLatencyMs.push(outcome.critiqueLatencyMs);
      }
      brainstormCalls += outcome.brainstormCalls;
      vocabularyFailures += outcome.vocabularyFailures;
      badEntitiesDropped += outcome.badEntitiesDropped;
      badRelationsDropped += outcome.badRelationsDropped;
      vocabularyRepairCallsAttempted += outcome.vocabularyRepairCallsAttempted;
      vocabularyRepairCallsSucceeded += outcome.vocabularyRepairCallsSucceeded;
      vocabularyRepairCallsFailed += outcome.vocabularyRepairCallsFailed;
      vocabularyRepairFailures += outcome.vocabularyRepairFailures;
      rowsRecoveredByRepair += outcome.rowsRecoveredByRepair;
      relationsCritiquedSources += outcome.relationsCritiquedSources;
      relationsCritiqueSkippedDueToDeadline +=
        outcome.relationsCritiqueSkippedDueToDeadline;
      relationsDroppedByCritique += outcome.relationsDroppedByCritique;
      relationCritiqueCalls += outcome.relationCritiqueCalls;
      if (outcome.sourceQualityTier !== undefined) {
        recordSourceQualityTier(outcome.sourceQualityTier);
      }
      if (outcome.sourceQualityScore !== undefined) {
        sourceQualityScoredSourceCount += 1;
        sourceQualityScoreSum += outcome.sourceQualityScore;
      }
      if (outcome.sourceQualityRecencyHours != null) {
        sourceQualityRecencyHoursSum += outcome.sourceQualityRecencyHours;
        sourceQualityRecencyHoursCount += 1;
      }
      if (outcome.extractionRetryAttempts > 0) {
        extractionRetriesSourcesRetried += 1;
        extractionRetriesTotalAttempts += outcome.extractionRetryAttempts;
        if (outcome.extractionRetrySucceeded) {
          extractionRetriesRecoveredByRetry += 1;
        } else {
          extractionRetriesExhausted += 1;
        }
      }
      if (outcome.extractionCallTimeouts > 0) {
        extractionCallTimeoutsTotal += outcome.extractionCallTimeouts;
      }
    };

    const processOneSource = createProcessOneSource({
      cfg,
      ctx,
      tickerId: input.tickerId,
      systemContent,
      resolvedExemplars,
      existingLookup,
      truncationTickerContext,
      sourceQualityHostTiers,
      runStart,
      isRunDeadlineElapsed,
      resolveAgainstExistingEntities,
      dataApiClient,
      log,
      hardDeleteDataSource: hardDeleteDataSourceById,
      sleep: sleepMs,
    });

    const extractionDeadlineAtMs =
      cfg.runDeadlineMs !== undefined && cfg.runDeadlineMs > 0
        ? runStart + cfg.runDeadlineMs
        : undefined;

    report(
      "Extracting entities and relations",
      `${batch.length} articles via LLM`,
    );

    const walkResult = await runExtractionsInParallel(batch, processOneSource, {
      concurrency: cfg.extractionConcurrency,
      deadlineAtMs: extractionDeadlineAtMs,
      onDeadlineSkip: (source) => {
        log.warn(
          {
            dataSourceId: source.id,
            runDeadlineMs: cfg.runDeadlineMs,
          },
          "article-analysis skipped source extraction due to run deadline",
        );
      },
    });

    extractionSkippedDueToDeadline =
      walkResult.stats.extractionSkippedDueToDeadline;
    parallelPeakInFlight = walkResult.stats.peakInFlight;
    parallelDeadlineFiredAtMs = walkResult.stats.deadlineFiredAtMs;

    for (const itemOutcome of walkResult.results) {
      if (itemOutcome.ok) {
        applySourceProcessingOutcome(itemOutcome.value);
        continue;
      }

      const source = batch[itemOutcome.index]!;
      const message =
        itemOutcome.error instanceof Error
          ? itemOutcome.error.message
          : String(itemOutcome.error);
      extractionFailures.push({
        dataSourceId: source.id,
        stage: "llm",
        message,
      });
      log.warn(
        {
          dataSourceId: source.id,
          stage: "llm",
          err: toSafeLogError(itemOutcome.error),
        },
        "article-analysis unexpected per-source processing failure; skipping",
      );
    }

    extractionSuccessCount = perSourceSignals.length;

    if (
      isArticleAnalysisExtractionPolicyFailure(
        extractionSuccessCount,
        cfg.runPolicy,
      )
    ) {
      const yieldSnapshot = emitRunSummaryAndYield({
        outcome: "failure",
        articlesProcessed: batch.length,
        extractionSuccessCount,
        extractionFailures,
        relevanceRowValidationFailures: 0,
        chunkParseCounts: { ...chunkParseCounts },
        postFailures: [],
        entitiesCreated: 0,
        entitiesReused: 0,
        relationsCreated: 0,
        articlesScored: 0,
        articlesSelected: 0,
        relevanceAggregate: null,
        llmUsage: llmUsageAccumulated ? llmUsageTotals : null,
        extractionLatencyMsTotal,
        extractionCalls,
        semanticFailureReason: "extraction_run_policy",
      });
      report(
        "Article analysis complete",
        deriveArticleAnalysisRunStatusLabel(
          extractionFailures.length,
          postFailures.length,
        ),
        "completed",
      );
      return {
        success: false,
        message: `Article analysis run failed: only ${extractionSuccessCount} source(s) extracted successfully, but run policy requires at least ${cfg.runPolicy.minSuccessfulSources}.`,
        details: {
          yieldSnapshot,
          extractionFailures,
          extractionSuccessCount,
          runPolicy: cfg.runPolicy,
          articlesScored: 0,
          articlesSelected: 0,
          relevancePostChunks: 0,
          postFailures: [] as ArticleAnalysisPostFailureRecord[],
          dataSourcesProcessed: batch.length,
          vocabularyFailures,
        },
      };
    }

    let entities = dedupeEntities(mergedEntities);
    let relations = dedupeRelations(mergedRelations);
    const runCapped = applyPerRunCaps(
      entities,
      relations,
      cfg.maxEntitiesPerRun,
      cfg.maxRelationsPerRun,
    );
    entities = runCapped.entities;
    relations = runCapped.relations;

    const llmFailureCount = extractionFailures.filter(
      (f) => f.stage === "llm",
    ).length;

    if (entities.length === 0 && relations.length === 0) {
      const runStatus = deriveArticleAnalysisRunStatusLabel(
        extractionFailures.length,
        postFailures.length,
      );
      const yieldSnapshot = emitRunSummaryAndYield({
        outcome: "success",
        articlesProcessed: batch.length,
        extractionSuccessCount,
        extractionFailures,
        relevanceRowValidationFailures: 0,
        chunkParseCounts: { ...chunkParseCounts },
        postFailures,
        entitiesCreated: 0,
        entitiesReused: 0,
        relationsCreated: 0,
        articlesScored: 0,
        articlesSelected: 0,
        relevanceAggregate: null,
        llmUsage: llmUsageAccumulated ? llmUsageTotals : null,
        extractionLatencyMsTotal,
        extractionCalls,
        runStatusLabel: runStatus,
      });
      return {
        success: true,
        message:
          llmFailureCount > 0 || extractionFailures.length > 0
            ? `no extraction produced (${extractionFailures.length} source(s) failed extraction; check logs)`
            : "extraction produced no entities or relations",
        details: {
          yieldSnapshot,
          dataSourcesProcessed: batch.length,
          extractionFailures,
          extractionSuccessCount,
          postFailures,
          llmFailures: llmFailureCount,
          runStatus,
          entitiesCreated: 0,
          entitiesReused: 0,
          relationsCreated: 0,
          postChunks: 0,
          articleEntityRowsPosted: 0,
          mentionPostChunks: 0,
          articlesScored: 0,
          articlesSelected: 0,
          relevancePostChunks: 0,
          vocabularyFailures,
        },
      };
    }

    const entityCatalog = buildNormalizedEntityCatalogFromProposals(entities);
    const {
      rows: articleRowsForRun,
      droppedCount: droppedArticleMentionsNotInRunCatalog,
    } = filterArticleEntityRowsToRunCatalog(
      mergedArticleEntityRows,
      entityCatalog,
    );
    if (droppedArticleMentionsNotInRunCatalog > 0) {
      log.warn(
        {
          droppedArticleMentionsNotInRunCatalog,
        },
        "article-analysis dropped article entity mentions not in run entity catalog",
      );
    }

    const {
      rows: canonicalArticleRowsForRun,
      droppedCount: droppedArticleMentionsUnmappableToCanonicalEntity,
      canonicalizedCount: canonicalizedArticleMentionsToCanonicalEntityName,
    } = canonicalizeArticleEntityRowsToRunEntities(articleRowsForRun, entities);
    if (droppedArticleMentionsUnmappableToCanonicalEntity > 0) {
      log.warn(
        {
          droppedArticleMentionsUnmappableToCanonicalEntity,
        },
        "article-analysis dropped article entity mentions not mappable to run canonical entity names",
      );
    }
    if (canonicalizedArticleMentionsToCanonicalEntityName > 0) {
      log.info(
        {
          canonicalizedArticleMentionsToCanonicalEntityName,
        },
        "article-analysis canonicalized article entity mention names before POST",
      );
    }

    let articleEntitiesForPost = dedupeArticleEntityMentions(
      canonicalArticleRowsForRun,
    );
    articleEntitiesForPost = applyPerRunArticleEntityCap(
      articleEntitiesForPost,
      cfg.maxArticleEntitiesPerRun,
    );

    const {
      rows: entityEvidenceForRun,
      droppedCount: droppedEntityEvidenceNotInRunCatalog,
    } = filterEntityEvidenceRowsToRunCatalog(
      dedupeEntityEvidence(mergedEntityEvidence),
      entityCatalog,
    );
    if (droppedEntityEvidenceNotInRunCatalog > 0) {
      log.warn(
        { droppedEntityEvidenceNotInRunCatalog },
        "article-analysis dropped entity evidence not in run entity catalog",
      );
    }

    const {
      rows: relationEvidenceForRun,
      droppedCount: droppedRelationEvidenceNotInRunCatalog,
    } = filterRelationEvidenceRowsToRunCatalog(
      dedupeRelationEvidence(mergedRelationEvidence),
      entityCatalog,
    );
    if (droppedRelationEvidenceNotInRunCatalog > 0) {
      log.warn(
        { droppedRelationEvidenceNotInRunCatalog },
        "article-analysis dropped relation evidence not in run entity catalog",
      );
    }

    const {
      rows: canonicalEntityEvidenceForRun,
      droppedCount: droppedEntityEvidenceUnmappable,
    } = canonicalizeEntityEvidenceRowsToRunEntities(
      entityEvidenceForRun,
      entities,
    );
    if (droppedEntityEvidenceUnmappable > 0) {
      log.warn(
        { droppedEntityEvidenceUnmappable },
        "article-analysis dropped entity evidence not mappable to run canonical entity names",
      );
    }

    const {
      rows: canonicalRelationEvidenceForRun,
      droppedCount: droppedRelationEvidenceUnmappable,
    } = canonicalizeRelationEvidenceRowsToRunEntities(
      relationEvidenceForRun,
      entities,
    );
    if (droppedRelationEvidenceUnmappable > 0) {
      log.warn(
        { droppedRelationEvidenceUnmappable },
        "article-analysis dropped relation evidence not mappable to run canonical entity names",
      );
    }

    const entityEvidenceForPost = dedupeEntityEvidence(
      canonicalEntityEvidenceForRun,
    );
    const relationEvidenceForPost = dedupeRelationEvidence(
      canonicalRelationEvidenceForRun,
    );

    report(
      "Persisting knowledge graph",
      `${entities.length} entities, ${relations.length} relations`,
    );

    const { chunks, parseErrors, droppedRelations } = buildAnalysisPostChunks(
      input.tickerId,
      entities,
      relations,
      cfg.postChunkRelationBatchSize,
      entityEvidenceForPost,
      relationEvidenceForPost,
    );
    chunkParseCounts.entityRelationChunkParseErrors = parseErrors.length;

    if (parseErrors.length > 0) {
      log.warn(
        {
          parseErrorCount: parseErrors.length,
          droppedRelations,
        },
        "article-analysis chunk build reported issues",
      );
    }

    if (chunks.length === 0) {
      const runStatus = deriveArticleAnalysisRunStatusLabel(
        extractionFailures.length,
        postFailures.length,
      );
      const yieldSnapshot = emitRunSummaryAndYield({
        outcome: "success",
        articlesProcessed: batch.length,
        extractionSuccessCount,
        extractionFailures,
        relevanceRowValidationFailures: 0,
        chunkParseCounts: { ...chunkParseCounts },
        postFailures,
        entitiesCreated: 0,
        entitiesReused: 0,
        relationsCreated: 0,
        articlesScored: 0,
        articlesSelected: 0,
        relevanceAggregate: null,
        llmUsage: llmUsageAccumulated ? llmUsageTotals : null,
        extractionLatencyMsTotal,
        extractionCalls,
        runStatusLabel: runStatus,
      });
      return {
        success: true,
        message:
          "no valid POST chunks after extraction (check relation endpoint names vs entity canonicalName)",
        details: {
          yieldSnapshot,
          dataSourcesProcessed: batch.length,
          relationCountAfterCaps: relations.length,
          droppedRelations,
          parseErrors: parseErrors.slice(0, 20),
          extractionFailures,
          extractionSuccessCount,
          postFailures,
          llmFailures: llmFailureCount,
          runStatus,
          articleEntityRowsPosted: 0,
          mentionPostChunks: 0,
          droppedArticleMentionsNotInRunCatalog,
          articlesScored: 0,
          articlesSelected: 0,
          relevancePostChunks: 0,
          vocabularyFailures,
        },
      };
    }

    let erPostChunksCompleted = 0;
    let erPhaseFailed = false;

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i]!;
      log.info(
        {
          chunkKind: "entities_relations",
          chunkIndex: i,
          chunkEntities: chunk.entities.length,
          chunkRelations: chunk.relations.length,
          model: cfg.openaiModel,
        },
        "article-analysis posting chunk",
      );
      try {
        const res = await executeAnalysisCreateWithTransientRetries(
          () => dataApiClient.analysis.create(chunk),
          {
            maxRetries: cfg.postTransientRetries,
            baseDelayMs: cfg.postTransientRetryBaseDelayMs,
            sleep: sleepMs,
          },
        );
        entitiesCreated += res.entitiesCreated;
        entitiesReused += res.entitiesReused;
        relationsCreated += res.relationsCreated;
        erPostChunksCompleted += 1;
      } catch (err) {
        postFailures.push(
          toArticleAnalysisPostFailureRecord("entities_relations", i, err),
        );
        log.warn(
          {
            chunkKind: "entities_relations",
            chunkIndex: i,
            err: toSafeLogError(err),
          },
          "article-analysis entities/relations POST failed; aborting remaining POST phases",
        );
        erPhaseFailed = true;
        break;
      }
    }

    report(
      "Posting article entity mentions",
      `${articleEntitiesForPost.length} mention rows`,
    );

    let articleEntityRowsPosted = 0;
    let mentionPostChunksCompleted = 0;
    let articleEntityParseErrors: string[] = [];

    if (!erPhaseFailed) {
      const { chunks: articleEntityChunks, parseErrors } =
        buildArticleEntityPostChunks(
          input.tickerId,
          articleEntitiesForPost,
          cfg.postChunkArticleEntityBatchSize,
        );
      articleEntityParseErrors = parseErrors;
      chunkParseCounts.articleEntityChunkParseErrors =
        articleEntityParseErrors.length;

      if (articleEntityParseErrors.length > 0) {
        log.warn(
          {
            parseErrorCount: articleEntityParseErrors.length,
          },
          "article-analysis articleEntity chunk build reported parse issues",
        );
      }

      for (let j = 0; j < articleEntityChunks.length; j++) {
        const mentionChunk = articleEntityChunks[j]!;
        log.info(
          {
            chunkKind: "article_entities",
            chunkIndex: j,
            chunkArticleEntities: mentionChunk.articleEntities.length,
            model: cfg.openaiModel,
          },
          "article-analysis posting chunk",
        );
        try {
          await executeAnalysisCreateWithTransientRetries(
            () => dataApiClient.analysis.create(mentionChunk),
            {
              maxRetries: cfg.postTransientRetries,
              baseDelayMs: cfg.postTransientRetryBaseDelayMs,
              sleep: sleepMs,
            },
          );
          articleEntityRowsPosted += mentionChunk.articleEntities.length;
          mentionPostChunksCompleted += 1;
        } catch (err) {
          postFailures.push(
            toArticleAnalysisPostFailureRecord("article_entities", j, err),
          );
          log.warn(
            {
              chunkKind: "article_entities",
              chunkIndex: j,
              err: toSafeLogError(err),
            },
            // Intentionally not breaking: article_entities are KG enrichment only.
            // Remaining chunks and the relevance phase proceed regardless.
            "article-analysis articleEntities POST failed; continuing to next chunk",
          );
        }
      }
    }

    let relevancePostChunksCompleted = 0;

    if (!erPhaseFailed && perSourceSignals.length > 0) {
      const urlByDataSourceId = new Map(batch.map((s) => [s.id, s.url]));
      report(
        "Scoring and posting article relevance",
        `${perSourceSignals.length} sources\n${perSourceSignals.map((s) => urlByDataSourceId.get(s.dataSourceId) ?? s.dataSourceId).join("\n")}`,
      );
      const weightMap = toRelevanceWeightMapV1(cfg);
      const relevanceDrafts = perSourceSignals.map((sig) =>
        buildDraftRelevanceRow(sig, cfg.scoreBreakdownVersion, weightMap),
      );
      const relevanceValidationErrors: string[] = [];
      for (const row of relevanceDrafts) {
        const vErr = validateRelevanceRowForPost(row, weightMap);
        if (vErr) {
          relevanceRowValidationFailures += 1;
          log.warn(
            { dataSourceId: row.dataSourceId, vErr },
            "article-analysis relevance row validation failed before selection",
          );
          relevanceValidationErrors.push(`${row.dataSourceId}: ${vErr}`);
        }
      }
      if (relevanceValidationErrors.length > 0) {
        const yieldSnapshot = emitRunSummaryAndYield({
          outcome: "failure",
          articlesProcessed: batch.length,
          extractionSuccessCount,
          extractionFailures,
          relevanceRowValidationFailures,
          chunkParseCounts: { ...chunkParseCounts },
          postFailures,
          entitiesCreated,
          entitiesReused,
          relationsCreated,
          articlesScored: articlesScoredTotal,
          articlesSelected: articlesSelectedTotal,
          relevanceAggregate: null,
          llmUsage: llmUsageAccumulated ? llmUsageTotals : null,
          extractionLatencyMsTotal,
          extractionCalls,
          runStatusLabel: deriveArticleAnalysisRunStatusLabel(
            extractionFailures.length,
            postFailures.length,
          ),
          semanticFailureReason: "relevance_row_validation",
        });
        return {
          success: false,
          message:
            "article-analysis relevance row validation failed before selection",
          details: {
            yieldSnapshot,
            tickerId: input.tickerId,
            validationErrorCount: relevanceValidationErrors.length,
            relevanceValidationErrors: relevanceValidationErrors.slice(0, 20),
          },
        };
      }

      const selectionInput = relevanceDrafts.map((row, idx) => ({
        ...row,
        _sortCreatedAt: perSourceSignals[idx]!.createdAt,
      }));
      const remainingBudget = Math.max(
        0,
        cfg.maxSelectedRelevancePerTickerPerDay -
          ctx.relevanceSelectionState.selectedCountToday,
      );
      const relevanceRows = cfg.useSelectionDiversification
        ? (() => {
            const diversified = applyRelevanceSelectionDiversified(
              selectionInput,
              perSourceSignals,
              {
                minScore: cfg.relevanceMinScore,
                remainingBudget,
                entityOverlapThreshold: cfg.selectionEntityOverlapThreshold,
                titleSimilarityThreshold: cfg.selectionTitleSimilarityThreshold,
              },
            );
            selectionEligibleRows = diversified.stats.eligibleRows;
            selectionClustersFormed = diversified.stats.clustersFormed;
            selectionSelectedAfterDiversification =
              diversified.stats.selectedAfterDiversification;
            selectionSuppressedAsDuplicates =
              diversified.stats.suppressedAsDuplicates;
            selectionLargestClusterSize = diversified.stats.largestClusterSize;
            return diversified.rows;
          })()
        : applyRelevanceSelection(
            selectionInput,
            cfg.relevanceMinScore,
            remainingBudget,
          );
      relevanceRowsForObservability = relevanceRows;

      const { chunks: relevanceChunks, parseErrors: relevanceParseErrors } =
        buildArticleRelevancePostChunks(
          input.tickerId,
          relevanceRows,
          cfg.postChunkArticleRelevanceBatchSize,
        );
      chunkParseCounts.articleRelevanceChunkParseErrors =
        relevanceParseErrors.length;

      if (relevanceParseErrors.length > 0) {
        log.warn(
          {
            parseErrorCount: relevanceParseErrors.length,
          },
          "article-analysis relevance chunk build reported parse issues",
        );
        const yieldSnapshot = emitRunSummaryAndYield({
          outcome: "failure",
          articlesProcessed: batch.length,
          extractionSuccessCount,
          extractionFailures,
          relevanceRowValidationFailures,
          chunkParseCounts: { ...chunkParseCounts },
          postFailures,
          entitiesCreated,
          entitiesReused,
          relationsCreated,
          articlesScored: articlesScoredTotal,
          articlesSelected: articlesSelectedTotal,
          relevanceAggregate: null,
          llmUsage: llmUsageAccumulated ? llmUsageTotals : null,
          extractionLatencyMsTotal,
          extractionCalls,
          runStatusLabel: deriveArticleAnalysisRunStatusLabel(
            extractionFailures.length,
            postFailures.length,
          ),
          semanticFailureReason: "relevance_chunk_parse",
        });
        return {
          success: false,
          message: "article-analysis relevance chunk parse failed",
          details: {
            yieldSnapshot,
            tickerId: input.tickerId,
            parseErrorCount: relevanceParseErrors.length,
            relevanceParseErrors: relevanceParseErrors.slice(0, 20),
          },
        };
      }

      for (let k = 0; k < relevanceChunks.length; k++) {
        const relChunk = relevanceChunks[k]!;
        log.info(
          {
            chunkKind: "article_relevances",
            chunkIndex: k,
            chunkArticleRelevances: relChunk.articleRelevances.length,
            model: cfg.openaiModel,
          },
          "article-analysis posting chunk",
        );
        try {
          const relRes = await executeAnalysisCreateWithTransientRetries(
            () => dataApiClient.analysis.create(relChunk),
            {
              maxRetries: cfg.postTransientRetries,
              baseDelayMs: cfg.postTransientRetryBaseDelayMs,
              sleep: sleepMs,
            },
          );
          articlesScoredTotal += relRes.articlesScored;
          articlesSelectedTotal += relRes.articlesSelected;
          relevancePostChunksCompleted += 1;
        } catch (err) {
          postFailures.push(
            toArticleAnalysisPostFailureRecord("article_relevances", k, err),
          );
          log.warn(
            {
              chunkKind: "article_relevances",
              chunkIndex: k,
              err: toSafeLogError(err),
            },
            "article-analysis articleRelevances POST failed",
          );
          break;
        }
      }
    }

    const runStatus = deriveArticleAnalysisRunStatusLabel(
      extractionFailures.length,
      postFailures.length,
    );

    const relevanceAggregate =
      relevanceRowsForObservability !== null
        ? aggregateRelevanceObservability(relevanceRowsForObservability)
        : null;

    const yieldSnapshot = emitRunSummaryAndYield({
      outcome: "success",
      articlesProcessed: batch.length,
      extractionSuccessCount,
      extractionFailures,
      relevanceRowValidationFailures,
      chunkParseCounts: { ...chunkParseCounts },
      postFailures,
      entitiesCreated,
      entitiesReused,
      relationsCreated,
      articlesScored: articlesScoredTotal,
      articlesSelected: articlesSelectedTotal,
      relevanceAggregate,
      llmUsage: llmUsageAccumulated ? llmUsageTotals : null,
      extractionLatencyMsTotal,
      extractionCalls,
      brainstormCalls,
      runStatusLabel: runStatus,
      ...(lastLlmPromptFingerprint !== undefined
        ? { llmPromptFingerprint: lastLlmPromptFingerprint }
        : {}),
    });

    const failedCount = extractionFailures.length;
    report(
      "Article analysis complete",
      `${extractionSuccessCount} extracted, ${failedCount} failed`,
      "completed",
    );

    return {
      success: true,
      message: `complete (${runStatus}): ${erPostChunksCompleted}/${chunks.length} ER chunk(s), ${mentionPostChunksCompleted} articleEntity chunk(s), ${relevancePostChunksCompleted} relevance chunk(s); entitiesCreated=${entitiesCreated} entitiesReused=${entitiesReused} relationsCreated=${relationsCreated} articleEntityRowsPosted=${articleEntityRowsPosted} articlesScored=${articlesScoredTotal} articlesSelected=${articlesSelectedTotal}`,
      details: {
        yieldSnapshot,
        dataSourcesProcessed: batch.length,
        dataSourcesReturned: ctx.dataSourceTotalCount,
        extractionFailures,
        extractionSuccessCount,
        postFailures,
        llmFailures: llmFailureCount,
        runStatus,
        postChunks: erPostChunksCompleted,
        entitiesCreated,
        entitiesReused,
        relationsCreated,
        articleEntityRowsPosted,
        mentionPostChunks: mentionPostChunksCompleted,
        droppedArticleMentionsNotInRunCatalog,
        articlesScored: articlesScoredTotal,
        articlesSelected: articlesSelectedTotal,
        relevancePostChunks: relevancePostChunksCompleted,
        relevanceSelectionBudgetRemaining: Math.max(
          0,
          cfg.maxSelectedRelevancePerTickerPerDay -
            ctx.relevanceSelectionState.selectedCountToday,
        ),
        droppedRelations,
        articleEntityParseErrors: articleEntityParseErrors.slice(0, 20),
        vocabularyFailures,
        ...(lastLlmPromptFingerprint !== undefined
          ? { llmPromptFingerprint: lastLlmPromptFingerprint }
          : {}),
      },
    };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "agent-data-api article-analysis run failed";
    log.error({ err: toSafeLogError(error) }, message);
    const yieldSnapshot = emitRunSummaryAndYield({
      outcome: "failure",
      articlesProcessed: articlesProcessedForSummary,
      extractionSuccessCount,
      extractionFailures,
      relevanceRowValidationFailures,
      chunkParseCounts: { ...chunkParseCounts },
      postFailures,
      entitiesCreated,
      entitiesReused,
      relationsCreated,
      articlesScored: articlesScoredTotal,
      articlesSelected: articlesSelectedTotal,
      relevanceAggregate: null,
      llmUsage: llmUsageAccumulated ? llmUsageTotals : null,
      extractionLatencyMsTotal,
      extractionCalls,
      topLevelError: toSafeLogError(error),
      ...(lastLlmPromptFingerprint !== undefined
        ? { llmPromptFingerprint: lastLlmPromptFingerprint }
        : {}),
    });
    return { success: false, message, details: { yieldSnapshot } };
  }
};
