import type { ArticleRelevanceRow } from "./analysis-relevance-scoring.js";
import { RELEVANCE_BREAKDOWN_CANONICAL_KEYS_V1 } from "./analysis-relevance-scoring.js";
import type {
  ArticleAnalysisExtractionFailureRecord,
  ArticleAnalysisPostFailureRecord,
} from "./article-analysis-run-policy.js";
import type { QualityDropReason } from "./utilities/content-quality-gate.js";
import type { ExtractionExemplarArchetype } from "./exemplars/default-extraction-exemplars.js";
import type { GroundingObservabilityAggregate } from "./utilities/entity-grounding.js";

/** Stable name for grep / log pipelines. */
export const ARTICLE_ANALYSIS_RUN_SUMMARY_MESSAGE =
  "article_analysis.run.summary";

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

export type ArticleAnalysisRunSummaryInput = {
  outcome: "success" | "failure";
  articlesProcessed: number;
  extractionSuccessCount: number;
  extractionFailures: readonly ArticleAnalysisExtractionFailureRecord[];
  droppedByContentQuality?: Record<QualityDropReason, number>;
  truncation?: TruncationObservabilityAggregate;
  exemplars?: ExemplarsObservabilityAggregate;
  grounding?: GroundingObservabilityAggregate;
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

  return base;
};
