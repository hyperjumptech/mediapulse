import type { ArticleRelevanceRow } from "./analysis-relevance-scoring.js";
import { RELEVANCE_BREAKDOWN_CANONICAL_KEYS_V1 } from "./analysis-relevance-scoring.js";
import type {
  ArticleAnalysisExtractionFailureRecord,
  ArticleAnalysisPostFailureRecord,
  ExtractionLlmFailureReason,
} from "./article-analysis-run-policy.js";
import type { QualityDropReason } from "./utilities/content-quality-gate.js";
import { createEmptyQualityCounters } from "./utilities/content-quality-gate.js";
import type { ExtractionExemplarArchetype } from "./exemplars/default-extraction-exemplars.js";
import type { GroundingObservabilityAggregate } from "./utilities/entity-grounding.js";

/** Stable name for grep / log pipelines. */
export const ARTICLE_ANALYSIS_RUN_SUMMARY_MESSAGE =
  "article_analysis.run.summary";

/** Stable name for per-run yield attribution logs. */
export const ARTICLE_ANALYSIS_YIELD_SNAPSHOT_MESSAGE =
  "article_analysis.yield.snapshot";

/** Stable name for yield regression warnings against operator baseline. */
export const ARTICLE_ANALYSIS_YIELD_REGRESSION_MESSAGE =
  "article_analysis.yield.regression";

/** Regression threshold: a ratio more than 15 points below baseline triggers a warning. */
export const YIELD_REGRESSION_DELTA_THRESHOLD = -0.15;

/**
 * Serializes an unknown error for structured logs without attaching rich provider payloads.
 *
 * @param error - Thrown value or Error.
 * @returns `{ type, message }` safe for Pino `bindings`.
 */
export const toSafeLogError = (
  error: unknown,
): { type: string; message: string } => {
  if (error instanceof Error) {
    return { type: error.name, message: error.message };
  }
  return { type: typeof error, message: String(error) };
};

const SCORE_BUCKET_LABELS = [
  "0_0.2",
  "0.2_0.4",
  "0.4_0.6",
  "0.6_0.8",
  "0.8_1",
] as const;

export type ScoreBucketCounts = Record<
  (typeof SCORE_BUCKET_LABELS)[number],
  number
>;

export type RelevanceObservabilityAggregate = {
  rowCount: number;
  scoreMin: number;
  scoreMax: number;
  scoreSum: number;
  scoreMean: number;
  scoreBuckets: ScoreBucketCounts;
  breakdownVersion: "mixed" | number;
  breakdownKeyMeans: Record<
    (typeof RELEVANCE_BREAKDOWN_CANONICAL_KEYS_V1)[number],
    number
  >;
  breakdownKeyMins: Record<
    (typeof RELEVANCE_BREAKDOWN_CANONICAL_KEYS_V1)[number],
    number
  >;
  breakdownKeyMaxs: Record<
    (typeof RELEVANCE_BREAKDOWN_CANONICAL_KEYS_V1)[number],
    number
  >;
};

/**
 * Picks the half-open score bucket label for a value in `[0, 1]`.
 *
 * @param score - Weighted relevance score.
 * @returns One of five fixed bucket keys; values at upper boundaries map to the higher bucket except `1` → last bucket.
 */
export const scoreBucketFor = (score: number): keyof ScoreBucketCounts => {
  if (score >= 0.8) {
    return "0.8_1";
  }
  if (score >= 0.6) {
    return "0.6_0.8";
  }
  if (score >= 0.4) {
    return "0.4_0.6";
  }
  if (score >= 0.2) {
    return "0.2_0.4";
  }
  return "0_0.2";
};

const emptyBuckets = (): ScoreBucketCounts => ({
  "0_0.2": 0,
  "0.2_0.4": 0,
  "0.4_0.6": 0,
  "0.6_0.8": 0,
  "0.8_1": 0,
});

/**
 * Aggregates score distribution and canonical breakdown stats over final relevance rows.
 *
 * @param rows - Article relevance rows (e.g. after selection); empty yields zeroed stats.
 * @returns Min/max/mean, fixed histogram buckets, per-key breakdown means; `_version` must match or `mixed`.
 */
export const aggregateRelevanceObservability = (
  rows: readonly ArticleRelevanceRow[],
): RelevanceObservabilityAggregate => {
  if (rows.length === 0) {
    const zeros = Object.fromEntries(
      RELEVANCE_BREAKDOWN_CANONICAL_KEYS_V1.map((k) => [k, 0]),
    ) as Record<(typeof RELEVANCE_BREAKDOWN_CANONICAL_KEYS_V1)[number], number>;
    return {
      rowCount: 0,
      scoreMin: 0,
      scoreMax: 0,
      scoreSum: 0,
      scoreMean: 0,
      scoreBuckets: emptyBuckets(),
      breakdownVersion: 0,
      breakdownKeyMeans: { ...zeros },
      breakdownKeyMins: { ...zeros },
      breakdownKeyMaxs: { ...zeros },
    };
  }

  let scoreMin = Number.POSITIVE_INFINITY;
  let scoreMax = Number.NEGATIVE_INFINITY;
  let scoreSum = 0;
  const buckets = emptyBuckets();
  let versionSeen: number | undefined;
  let versionMixed = false;

  const keySums = Object.fromEntries(
    RELEVANCE_BREAKDOWN_CANONICAL_KEYS_V1.map((k) => [k, 0]),
  ) as Record<(typeof RELEVANCE_BREAKDOWN_CANONICAL_KEYS_V1)[number], number>;

  const keyMins = Object.fromEntries(
    RELEVANCE_BREAKDOWN_CANONICAL_KEYS_V1.map((k) => [
      k,
      Number.POSITIVE_INFINITY,
    ]),
  ) as Record<(typeof RELEVANCE_BREAKDOWN_CANONICAL_KEYS_V1)[number], number>;

  const keyMaxs = Object.fromEntries(
    RELEVANCE_BREAKDOWN_CANONICAL_KEYS_V1.map((k) => [
      k,
      Number.NEGATIVE_INFINITY,
    ]),
  ) as Record<(typeof RELEVANCE_BREAKDOWN_CANONICAL_KEYS_V1)[number], number>;

  for (const row of rows) {
    const s = row.score;
    scoreMin = Math.min(scoreMin, s);
    scoreMax = Math.max(scoreMax, s);
    scoreSum += s;
    buckets[scoreBucketFor(s)] += 1;

    const ver = row.scoreBreakdown._version;
    if (typeof ver === "number" && Number.isFinite(ver)) {
      if (versionSeen === undefined) {
        versionSeen = ver;
      } else if (versionSeen !== ver) {
        versionMixed = true;
      }
    }

    for (const key of RELEVANCE_BREAKDOWN_CANONICAL_KEYS_V1) {
      const v = row.scoreBreakdown[key];
      if (typeof v === "number" && Number.isFinite(v)) {
        keySums[key] += v;
        keyMins[key] = Math.min(keyMins[key], v);
        keyMaxs[key] = Math.max(keyMaxs[key], v);
      }
    }
  }

  const n = rows.length;
  const breakdownKeyMeans = Object.fromEntries(
    RELEVANCE_BREAKDOWN_CANONICAL_KEYS_V1.map((k) => [k, keySums[k] / n]),
  ) as Record<(typeof RELEVANCE_BREAKDOWN_CANONICAL_KEYS_V1)[number], number>;

  const breakdownKeyMinsFinal = Object.fromEntries(
    RELEVANCE_BREAKDOWN_CANONICAL_KEYS_V1.map((k) => [
      k,
      keyMins[k] === Number.POSITIVE_INFINITY ? 0 : keyMins[k],
    ]),
  ) as Record<(typeof RELEVANCE_BREAKDOWN_CANONICAL_KEYS_V1)[number], number>;

  const breakdownKeyMaxsFinal = Object.fromEntries(
    RELEVANCE_BREAKDOWN_CANONICAL_KEYS_V1.map((k) => [
      k,
      keyMaxs[k] === Number.NEGATIVE_INFINITY ? 0 : keyMaxs[k],
    ]),
  ) as Record<(typeof RELEVANCE_BREAKDOWN_CANONICAL_KEYS_V1)[number], number>;

  return {
    rowCount: n,
    scoreMin,
    scoreMax,
    scoreSum,
    scoreMean: scoreSum / n,
    scoreBuckets: buckets,
    breakdownVersion: versionMixed ? "mixed" : (versionSeen ?? 0),
    breakdownKeyMeans,
    breakdownKeyMins: breakdownKeyMinsFinal,
    breakdownKeyMaxs: breakdownKeyMaxsFinal,
  };
};

export type ChunkBuildParseCounts = {
  entityRelationChunkParseErrors: number;
  articleEntityChunkParseErrors: number;
  articleRelevanceChunkParseErrors: number;
};

export type LlmUsageTotals = {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  brainstormCalls: number;
  brainstormPromptTokens: number;
  brainstormCompletionTokens: number;
  critiqueCalls: number;
  critiquePromptTokens: number;
  critiqueCompletionTokens: number;
};

export type RelationCritiqueObservabilityAggregate = {
  sourcesCritiqued: number;
  relationsDroppedByCritique: number;
  critiqueCalls: number;
  critiquePromptTokens: number;
  critiqueCompletionTokens: number;
};

export type VocabularyPartitioningObservabilityAggregate = {
  badEntitiesDropped: number;
  badRelationsDropped: number;
  repairCallsAttempted: number;
  repairCallsSucceeded: number;
  repairCallsFailed: number;
  rowsRecoveredByRepair: number;
};

export type SourceQualityObservabilityAggregate = {
  tier1Sources: number;
  tier2Sources: number;
  tier3Sources: number;
  unknownHostSources: number;
  avgRecencyHours: number | null;
  avgQualityScore: number;
};

export type SelectionObservabilityAggregate = {
  eligibleRows: number;
  clustersFormed: number;
  selectedAfterDiversification: number;
  suppressedAsDuplicates: number;
  largestClusterSize: number;
};

export type TruncationObservabilityAggregate = {
  leadCharsKept: number;
  tickerSentencesKept: number;
  paragraphsKept: number;
  paragraphsDropped: number;
};

export type ExemplarsObservabilityAggregate = {
  requestedCount: number;
  resolvedCount: number;
  appliedArchetypes: readonly ExtractionExemplarArchetype[];
};

export type ParallelismObservabilityAggregate = {
  concurrency: number;
  peakInFlight: number;
  extractionSkippedDueToDeadline: number;
  deadlineFiredAtMs?: number;
};

export type ExtractionRetryObservabilityAggregate = {
  sourcesRetried: number;
  totalRetryAttempts: number;
  recoveredByRetry: number;
  exhausted: number;
};

/** Per-reason counts for `stage: "llm"` non-response failures. */
export type ExtractionNonResponseBreakdown = Record<
  ExtractionLlmFailureReason,
  number
>;

/** Per-source latency samples collected during parallel extraction. */
export type PerSourceLatencyObservability = {
  extractionMs: number[];
  brainstormMs: number[];
  critiqueMs: number[];
};

/** Operator-supplied P50 baselines for yield regression comparison (not auto-computed). */
export type HistoricalYieldBaseline = {
  extractionYieldP50?: number;
  groundingYieldP50?: number;
  vocabularyYieldP50?: number;
};

export type YieldSnapshotRatios = {
  extractionYield: number;
  groundingYield: number;
  vocabularyYield: number;
  selectionYield: number;
};

export type YieldSnapshotLatency = {
  extractionMsP50: number | null;
  extractionMsP95: number | null;
  brainstormMsP50: number | null;
  critiqueMsP50: number | null;
};

/** Per-run rollup of pass/drop attribution across pipeline stages. */
export type YieldSnapshot = {
  batchSize: number;
  passed: {
    qualityGate: number;
    grounding: number;
    vocabulary: number;
    scoring: number;
    selection: number;
  };
  dropped: {
    byContentQuality: Record<QualityDropReason, number>;
    byGrounding: { entities: number; relations: number; mentions: number };
    byVocabulary: { entities: number; relations: number; repaired: number };
    bySelectionDiversification: number;
    byDeadline: number;
    byCritique: number;
  };
  ratios: YieldSnapshotRatios;
  latency: YieldSnapshotLatency;
};

export type YieldBaselineComparisonDeltas = {
  extractionYieldDelta?: number;
  groundingYieldDelta?: number;
  vocabularyYieldDelta?: number;
};

export type YieldBaselineComparison = {
  regression: boolean;
  baseline: HistoricalYieldBaseline | "unset";
  deltas: YieldBaselineComparisonDeltas | null;
};

export type ArticleAnalysisRunSummaryInput = {
  outcome: "success" | "failure";
  articlesProcessed: number;
  extractionSuccessCount: number;
  extractionFailures: readonly ArticleAnalysisExtractionFailureRecord[];
  droppedByContentQuality?: Record<QualityDropReason, number>;
  truncation?: TruncationObservabilityAggregate;
  exemplars?: ExemplarsObservabilityAggregate;
  grounding?: GroundingObservabilityAggregate;
  relationCritique?: RelationCritiqueObservabilityAggregate;
  vocabularyPartitioning?: VocabularyPartitioningObservabilityAggregate;
  sourceQuality?: SourceQualityObservabilityAggregate;
  selection?: SelectionObservabilityAggregate;
  relevanceRowValidationFailures: number;
  chunkParseCounts: ChunkBuildParseCounts;
  postFailures: readonly ArticleAnalysisPostFailureRecord[];
  entitiesCreated: number;
  entitiesReused: number;
  relationsCreated: number;
  articlesScored: number;
  articlesSelected: number;
  relevanceAggregate: RelevanceObservabilityAggregate | null;
  llmUsage: LlmUsageTotals | null;
  extractionLatencyMsTotal: number;
  extractionCalls: number;
  brainstormCalls?: number;
  runStatusLabel?: string;
  semanticFailureReason?: string;
  topLevelError?: ReturnType<typeof toSafeLogError>;
  /** Fingerprint of the last extraction system+user prompts sent to the LLM (REQ-011). */
  llmPromptFingerprint?: string;
  parallelism?: ParallelismObservabilityAggregate;
  perSourceLatency?: PerSourceLatencyObservability;
  extractionRetries?: ExtractionRetryObservabilityAggregate;
  extractionNonResponse?: ExtractionNonResponseBreakdown;
  extractionCallTimeouts?: number;
};

/**
 * Computes the p-th percentile (0–1) from a numeric sample.
 *
 * @param values - Unsorted latency or score samples.
 * @param p - Percentile in `[0, 1]` (e.g. `0.5` for median).
 * @returns Percentile value or `null` when `values` is empty.
 */
export const percentileOf = (
  values: readonly number[],
  p: number,
): number | null => {
  if (values.length === 0) {
    return null;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil(p * sorted.length) - 1),
  );
  return sorted[index] ?? null;
};

/**
 * Aggregates `stage: "llm"` failure records by their `reason` field.
 *
 * @param failures - All per-source extraction failure records for the run.
 * @returns Per-reason counts for the non-response breakdown dashboard bucket.
 */
export const aggregateExtractionNonResponseBreakdown = (
  failures: readonly ArticleAnalysisExtractionFailureRecord[],
): ExtractionNonResponseBreakdown => {
  const breakdown: ExtractionNonResponseBreakdown = {
    length_truncation: 0,
    empty_stop: 0,
    content_filter: 0,
    timeout: 0,
    other: 0,
  };
  for (const failure of failures) {
    if (failure.stage === "llm" && failure.reason !== undefined) {
      breakdown[failure.reason] += 1;
    } else if (failure.stage === "llm") {
      breakdown.other += 1;
    }
  }

  return breakdown;
};

/**
 * Rolls up per-stage pass/drop counters and ratios from a run summary input.
 *
 * @param input - Same counters emitted on `article_analysis.run.summary`.
 * @returns Forward-compatible yield snapshot for logs and agent result details.
 */
export const buildYieldSnapshot = (
  input: ArticleAnalysisRunSummaryInput,
): YieldSnapshot => {
  const batchSize = input.articlesProcessed;
  const byContentQuality = {
    ...createEmptyQualityCounters(),
    ...(input.droppedByContentQuality ?? {}),
  };
  const contentQualityDrops = Object.values(byContentQuality).reduce(
    (sum, count) => sum + count,
    0,
  );
  const deadlineDrops = input.parallelism?.extractionSkippedDueToDeadline ?? 0;

  const llmFails = input.extractionFailures.filter(
    (failure) => failure.stage === "llm",
  ).length;
  const vocabFails = input.extractionFailures.filter(
    (failure) => failure.stage === "vocabulary",
  ).length;

  const passedQualityGate = batchSize - contentQualityDrops - deadlineDrops;
  const passedGrounding = passedQualityGate - llmFails - vocabFails;
  const passedVocabulary = input.extractionSuccessCount;
  const passedScoring = input.articlesScored;
  const passedSelection = input.articlesSelected;

  const grounding = input.grounding;
  const vocabulary = input.vocabularyPartitioning;
  const selection = input.selection;
  const relationCritique = input.relationCritique;

  const safeRatio = (numerator: number): number =>
    batchSize > 0 ? numerator / batchSize : 0;

  const latencySamples = input.perSourceLatency ?? {
    extractionMs: [],
    brainstormMs: [],
    critiqueMs: [],
  };

  return {
    batchSize,
    passed: {
      qualityGate: passedQualityGate,
      grounding: passedGrounding,
      vocabulary: passedVocabulary,
      scoring: passedScoring,
      selection: passedSelection,
    },
    dropped: {
      byContentQuality,
      byGrounding: {
        entities: grounding?.entitiesUngroundedTotal ?? 0,
        relations: grounding?.relationsDroppedTotal ?? 0,
        mentions: grounding?.mentionsDroppedTotal ?? 0,
      },
      byVocabulary: {
        entities: vocabulary?.badEntitiesDropped ?? 0,
        relations: vocabulary?.badRelationsDropped ?? 0,
        repaired: vocabulary?.rowsRecoveredByRepair ?? 0,
      },
      bySelectionDiversification: selection?.suppressedAsDuplicates ?? 0,
      byDeadline: deadlineDrops,
      byCritique: relationCritique?.relationsDroppedByCritique ?? 0,
    },
    ratios: {
      extractionYield: safeRatio(passedVocabulary),
      groundingYield: safeRatio(passedGrounding),
      vocabularyYield: safeRatio(passedVocabulary),
      selectionYield: safeRatio(passedSelection),
    },
    latency: {
      extractionMsP50: percentileOf(latencySamples.extractionMs, 0.5),
      extractionMsP95: percentileOf(latencySamples.extractionMs, 0.95),
      brainstormMsP50: percentileOf(latencySamples.brainstormMs, 0.5),
      critiqueMsP50: percentileOf(latencySamples.critiqueMs, 0.5),
    },
  };
};

/** Alias for {@link buildYieldSnapshot} used when attaching yield to run results. */
export const getRunYieldSnapshot = buildYieldSnapshot;

/**
 * Builds a JSON-safe log payload for `article_analysis.yield.snapshot`.
 *
 * @param snapshot - Derived yield snapshot for one run.
 * @returns Payload to pass as first argument to `log.info`.
 */
export const buildYieldSnapshotLogPayload = (
  snapshot: YieldSnapshot,
): Record<string, unknown> => ({
  event: ARTICLE_ANALYSIS_YIELD_SNAPSHOT_MESSAGE,
  ...snapshot,
});

/**
 * Compares run yield ratios against operator-supplied P50 baselines.
 *
 * @param snapshot - Current run yield snapshot.
 * @param baseline - Optional Hermes config baselines; when unset, comparison is silent.
 * @returns Regression flag and per-dimension deltas (null when baseline unset).
 */
export const compareYieldAgainstBaseline = (
  snapshot: YieldSnapshot,
  baseline: HistoricalYieldBaseline | undefined,
): YieldBaselineComparison => {
  if (
    baseline === undefined ||
    (baseline.extractionYieldP50 === undefined &&
      baseline.groundingYieldP50 === undefined &&
      baseline.vocabularyYieldP50 === undefined)
  ) {
    return { regression: false, baseline: "unset", deltas: null };
  }

  const deltas: YieldBaselineComparisonDeltas = {};
  if (baseline.extractionYieldP50 !== undefined) {
    deltas.extractionYieldDelta =
      snapshot.ratios.extractionYield - baseline.extractionYieldP50;
  }
  if (baseline.groundingYieldP50 !== undefined) {
    deltas.groundingYieldDelta =
      snapshot.ratios.groundingYield - baseline.groundingYieldP50;
  }
  if (baseline.vocabularyYieldP50 !== undefined) {
    deltas.vocabularyYieldDelta =
      snapshot.ratios.vocabularyYield - baseline.vocabularyYieldP50;
  }

  const regression = Object.values(deltas).some(
    (delta) => delta !== undefined && delta <= YIELD_REGRESSION_DELTA_THRESHOLD,
  );

  return { regression, baseline, deltas };
};

/**
 * Builds a single JSON-safe object for one structured info log line.
 *
 * Includes **`stageMetrics`** (extract / scorePrepare / persist) and **`failureCountsByKind`**
 * so LLM, vocabulary, schema or row validation, and HTTP persistence failures stay separable
 * in metrics backends (MP-ART-ANALYSIS-008).
 *
 * @param input - Counters and aggregates at end of run (or failure path).
 * @returns Payload to pass as first argument to `log.info`.
 */
export const buildArticleAnalysisRunSummaryPayload = (
  input: ArticleAnalysisRunSummaryInput,
): Record<string, unknown> => {
  const vocabFails = input.extractionFailures.filter(
    (f) => f.stage === "vocabulary",
  ).length;
  const llmFails = input.extractionFailures.filter(
    (f) => f.stage === "llm",
  ).length;
  const prefilterFails = input.extractionFailures.filter(
    (f) => f.stage === "prefilter",
  ).length;

  const postByKind = {
    entities_relations: 0,
    article_entities: 0,
    article_relevances: 0,
  } as Record<ArticleAnalysisPostFailureRecord["chunkKind"], number>;

  const postByCategory = {
    agent_data_api_http: 0,
    unknown: 0,
  } as Record<ArticleAnalysisPostFailureRecord["errorCategory"], number>;

  for (const p of input.postFailures) {
    postByKind[p.chunkKind] += 1;
    postByCategory[p.errorCategory] += 1;
  }

  const schemaValidationFailureCount =
    input.relevanceRowValidationFailures +
    input.chunkParseCounts.entityRelationChunkParseErrors +
    input.chunkParseCounts.articleEntityChunkParseErrors +
    input.chunkParseCounts.articleRelevanceChunkParseErrors;

  const denom = input.entitiesCreated + input.entitiesReused;
  const entityReuseRatio = denom > 0 ? input.entitiesReused / denom : null;
  const scoreFailureCount =
    input.relevanceRowValidationFailures +
    input.chunkParseCounts.articleRelevanceChunkParseErrors +
    postByKind.article_relevances;

  const extractionCalls = input.extractionCalls;
  const brainstormCalls = input.brainstormCalls ?? 0;
  const avgExtractionLatencyMs =
    extractionCalls > 0
      ? input.extractionLatencyMsTotal / extractionCalls
      : null;

  const base: Record<string, unknown> = {
    event: ARTICLE_ANALYSIS_RUN_SUMMARY_MESSAGE,
    outcome: input.outcome,
    articlesProcessed: input.articlesProcessed,
    extractionSuccessCount: input.extractionSuccessCount,
    extractionFailureCount: input.extractionFailures.length,
    extractionFailuresPrefilter: prefilterFails,
    extractionFailuresVocabulary: vocabFails,
    extractionFailuresLlm: llmFails,
    scoreFailureCount,
    relevanceRowValidationFailures: input.relevanceRowValidationFailures,
    chunkParseErrorsEntityRelation:
      input.chunkParseCounts.entityRelationChunkParseErrors,
    chunkParseErrorsArticleEntity:
      input.chunkParseCounts.articleEntityChunkParseErrors,
    chunkParseErrorsArticleRelevance:
      input.chunkParseCounts.articleRelevanceChunkParseErrors,
    schemaValidationFailureCount,
    failureCountsByKind: {
      llm: llmFails,
      vocabulary: vocabFails,
      prefilter: prefilterFails,
      schemaValidation: schemaValidationFailureCount,
      persistenceHttp: postByCategory.agent_data_api_http,
      persistenceOther: postByCategory.unknown,
    },
    stageMetrics: {
      extract: {
        articlesProcessed: input.articlesProcessed,
        articlesSucceeded: input.extractionSuccessCount,
        articlesFailedExtraction: input.extractionFailures.length,
      },
      scorePrepare: {
        schemaValidationFailures: schemaValidationFailureCount,
      },
      persist: {
        postChunkFailures: input.postFailures.length,
        articlesScored: input.articlesScored,
        articlesSelected: input.articlesSelected,
      },
    },
    postFailureCount: input.postFailures.length,
    postFailuresByChunkKind: postByKind,
    postFailuresByErrorCategory: postByCategory,
    entitiesCreated: input.entitiesCreated,
    entitiesReused: input.entitiesReused,
    entityReuseRatio,
    relationsCreated: input.relationsCreated,
    articlesScored: input.articlesScored,
    articlesSelected: input.articlesSelected,
    extractionLatencyMsTotal: input.extractionLatencyMsTotal,
    extractionCalls,
    brainstormCalls,
    avgExtractionLatencyMs,
  };

  if (input.llmPromptFingerprint !== undefined) {
    base.llmPromptFingerprint = input.llmPromptFingerprint;
  }

  if (input.runStatusLabel !== undefined) {
    base.runStatus = input.runStatusLabel;
  }
  if (input.semanticFailureReason !== undefined) {
    base.semanticFailureReason = input.semanticFailureReason;
  }
  if (input.topLevelError !== undefined) {
    base.error = input.topLevelError;
  }
  if (input.llmUsage !== null) {
    base.llmPromptTokens = input.llmUsage.promptTokens;
    base.llmCompletionTokens = input.llmUsage.completionTokens;
    base.llmTotalTokens = input.llmUsage.totalTokens;
    base.llmBrainstormCalls = input.llmUsage.brainstormCalls;
    base.llmBrainstormPromptTokens = input.llmUsage.brainstormPromptTokens;
    base.llmBrainstormCompletionTokens =
      input.llmUsage.brainstormCompletionTokens;
    base.llmCritiqueCalls = input.llmUsage.critiqueCalls;
    base.llmCritiquePromptTokens = input.llmUsage.critiquePromptTokens;
    base.llmCritiqueCompletionTokens = input.llmUsage.critiqueCompletionTokens;
  }
  if (input.relevanceAggregate !== null) {
    base.relevanceRowCount = input.relevanceAggregate.rowCount;
    base.scoreMin = input.relevanceAggregate.scoreMin;
    base.scoreMax = input.relevanceAggregate.scoreMax;
    base.scoreMean = input.relevanceAggregate.scoreMean;
    base.scoreBuckets = input.relevanceAggregate.scoreBuckets;
    base.breakdownVersion = input.relevanceAggregate.breakdownVersion;
    base.breakdownKeyMeans = input.relevanceAggregate.breakdownKeyMeans;
    base.breakdownKeyMins = input.relevanceAggregate.breakdownKeyMins;
    base.breakdownKeyMaxs = input.relevanceAggregate.breakdownKeyMaxs;
  }

  if (input.droppedByContentQuality !== undefined) {
    base.droppedByContentQuality = input.droppedByContentQuality;
  }

  if (input.truncation !== undefined) {
    base.truncation = input.truncation;
  }

  if (input.exemplars !== undefined) {
    base.exemplarsRequestedCount = input.exemplars.requestedCount;
    base.exemplarsResolvedCount = input.exemplars.resolvedCount;
    base.exemplarsApplied = input.exemplars.appliedArchetypes;
  }

  if (input.grounding !== undefined) {
    base.grounding = input.grounding;
  }

  if (input.relationCritique !== undefined) {
    base.relationCritique = input.relationCritique;
  }

  if (input.vocabularyPartitioning !== undefined) {
    base.vocabularyPartitioning = input.vocabularyPartitioning;
  }

  if (input.sourceQuality !== undefined) {
    base.sourceQuality = input.sourceQuality;
  }

  if (input.selection !== undefined) {
    base.selection = input.selection;
  }

  if (input.parallelism !== undefined) {
    base.parallelism = input.parallelism;
  }

  if (input.extractionRetries !== undefined) {
    base.extractionRetries = input.extractionRetries;
  }

  if (
    input.extractionCallTimeouts !== undefined &&
    input.extractionCallTimeouts > 0
  ) {
    base.extractionCallTimeouts = input.extractionCallTimeouts;
  }

  if (input.extractionNonResponse !== undefined) {
    base.extractionNonResponse = input.extractionNonResponse;
  } else if (llmFails > 0) {
    base.extractionNonResponse = aggregateExtractionNonResponseBreakdown(
      input.extractionFailures,
    );
  }

  return base;
};
