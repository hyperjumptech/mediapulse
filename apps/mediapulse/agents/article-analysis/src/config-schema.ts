import { ANALYSIS_GET_DATA_SOURCE_LIMIT_MAX } from "@workspace/agent-data-api-contract";
import { reasoningEffortSchema } from "@workspace/agent-runtime";
import type { RelevanceWeightMapV1 } from "./analysis-relevance-scoring.js";
import type { ArticleAnalysisRunPolicy } from "./article-analysis-run-policy.js";
import type { ExtractionExemplarArchetype } from "./exemplars/default-extraction-exemplars.js";
import { z } from "zod";

const extractionExemplarArchetypeSchema = z.enum([
  "earnings",
  "legal",
  "leadership",
  "product",
]);

const articleAnalysisRunPolicySchema = z.object({
  minSuccessfulSources: z.number().int().nonnegative().optional(),
  failOnZeroSuccess: z.boolean().optional(),
});

/**
 * Hermes agent config for article-analysis (extraction, caps, chunking, relevance, debounce).
 * Operational defaults are filled by {@link resolveArticleAnalysisConfig}.
 */
export const articleAnalysisConfigSchema = z
  .object({
    verbose: z.boolean().optional(),
    /** OpenAI-compatible API key for structured extraction. */
    openaiApiKey: z.string().min(1),
    /** Chat model id (e.g. `gpt-4o-mini`). */
    openaiModel: z.string().min(1).optional(),
    /**
     * Reasoning effort applied to all LLM passes when the model supports it (gpt-5/o-series).
     * Leave unset for non-reasoning models like gpt-4o-mini.
     */
    reasoningEffort: reasoningEffortSchema.optional(),
    /**
     * Reasoning effort for the extraction pass only. Falls back to `reasoningEffort` when unset.
     */
    extractionReasoningEffort: reasoningEffortSchema.optional(),
    /** Truncate article text in the LLM user message (full text remains in DB). */
    maxContentChars: z.number().int().positive().optional(),
    /** When true, use structure-aware paragraph truncation instead of naive slice. */
    useStructureAwareTruncation: z.boolean().optional(),
    /** Lead paragraphs always kept before score-ranked allocation. */
    truncationLeadParagraphsAlwaysKept: z
      .number()
      .int()
      .min(0)
      .max(8)
      .optional(),
    /** Operator-extensible financial keywords for truncation scoring. */
    truncationFinancialKeywordsExtra: z.array(z.string()).optional(),
    /** Number of few-shot extraction exemplars to inject (0 disables). */
    fewShotExemplarCount: z.number().int().min(0).max(4).optional(),
    /** When set, only these archetypes are eligible for few-shot selection. */
    fewShotExemplarArchetypes: z
      .array(extractionExemplarArchetypeSchema)
      .optional(),
    /** When true, run a free-form brainstorm pass before structured extraction. */
    useBrainstormPass: z.boolean().optional(),
    /** Chat model for the brainstorm pass (defaults to `openaiModel`). */
    brainstormModel: z.string().min(1).optional(),
    /** Overrides `reasoningEffort` for the brainstorm pass. */
    brainstormReasoningEffort: reasoningEffortSchema.optional(),
    /** Max concurrent per-source extractions (1 = sequential; opt-in parallelism). */
    extractionConcurrency: z.number().int().min(1).max(16).optional(),
    /** Wall-clock budget in ms from run start; skips undispatched sources and late brainstorm/critique. */
    runDeadlineMs: z.number().int().positive().optional(),
    /** When true, run a second LLM pass to critique and prune noisy relation triples. */
    useRelationSelfCritique: z.boolean().optional(),
    /** Max fraction of relations per source that critique may drop (hard cap). */
    relationCritiqueDropFraction: z.number().min(0).max(0.5).optional(),
    /** Skip critique when a source has fewer relations than this threshold. */
    relationCritiqueMinRelationCount: z.number().int().nonnegative().optional(),
    /** Chat model for relation critique (defaults to `openaiModel`). */
    relationCritiqueModel: z.string().min(1).optional(),
    /** Overrides `reasoningEffort` for the relation-critique pass. */
    relationCritiqueReasoningEffort: reasoningEffortSchema.optional(),
    /**
     * How to handle vocabulary-invalid extraction rows.
     * `strict` skips the whole source (legacy). `partition` drops bad rows. `repair` partitions then re-labels bad rows once.
     */
    vocabularyPolicy: z.enum(["strict", "partition", "repair"]).optional(),
    /** Chat model for vocabulary repair (defaults to `openaiModel`). */
    vocabularyRepairModel: z.string().min(1).optional(),
    /** Overrides `reasoningEffort` for the vocabulary-repair pass. */
    vocabularyRepairReasoningEffort: reasoningEffortSchema.optional(),
    /** Skip repair when rejected row count exceeds this cap (likely systemic vocabulary drift). */
    vocabularyRepairMaxItems: z.number().int().positive().optional(),
    /** Post-extraction grounding policy for hallucinated entities. */
    entityGroundingPolicy: z.enum(["drop", "flag", "off"]).optional(),
    /** When greater than zero, entity must appear in the title to count as grounded. */
    entityGroundingMinTitleHits: z.number().int().nonnegative().optional(),
    maxEntitiesPerArticle: z.number().int().positive().optional(),
    maxRelationsPerArticle: z.number().int().positive().optional(),
    maxEntitiesPerRun: z.number().int().positive().optional(),
    maxRelationsPerRun: z.number().int().positive().optional(),
    /** Max relations per POST chunk (FR9); entity closure is added per chunk. */
    postChunkRelationBatchSize: z.number().int().positive().optional(),
    /** Max `articleEntities` rows per source after LLM extract (before run merge). */
    maxArticleEntitiesPerArticle: z.number().int().positive().optional(),
    /** Max `articleEntities` rows for the run after dedupe (before POST). */
    maxArticleEntitiesPerRun: z.number().int().positive().optional(),
    /** Max `articleEntities` rows per POST chunk. */
    postChunkArticleEntityBatchSize: z.number().int().positive().optional(),
    /** Stored in `scoreBreakdown._version` (must match Hermes when bumping breakdown schema). */
    scoreBreakdownVersion: z.number().int().min(1).optional(),
    relevanceWeightBreakingNews: z.number().nonnegative().optional(),
    relevanceWeightKgRelation: z.number().nonnegative().optional(),
    relevanceWeightFundamental: z.number().nonnegative().optional(),
    relevanceWeightTickerSalience: z.number().nonnegative().optional(),
    relevanceWeightSourceQuality: z.number().nonnegative().optional(),
    /** When true, compute real `sourceQuality` from host tier, recency, and structural cues. */
    useSourceQualityV2: z.boolean().optional(),
    /** Recency half-life (hours) for source-quality exponential decay. */
    sourceQualityRecencyHalfLifeHours: z.number().positive().optional(),
    /** Replaces default tier-1 host suffix list when set. */
    sourceQualityHostTier1: z.array(z.string()).optional(),
    /** Replaces default tier-2 host suffix list when set. */
    sourceQualityHostTier2: z.array(z.string()).optional(),
    /** Replaces default tier-3 host suffix list when set. */
    sourceQualityHostTier3: z.array(z.string()).optional(),
    /** When true, diversify `selected` rows by entity/title event clusters. */
    useSelectionDiversification: z.boolean().optional(),
    /** Jaccard threshold for merging rows by shared entity names (default 0.5). */
    selectionEntityOverlapThreshold: z.number().min(0).max(1).optional(),
    /** Jaccard threshold for merging rows by title 4-gram overlap (default 0.4). */
    selectionTitleSimilarityThreshold: z.number().min(0).max(1).optional(),
    /** Minimum score to be eligible for `selected: true`. */
    relevanceMinScore: z.number().min(0).max(1).optional(),
    /** Cap on additional `selected` rows per UTC day (budget minus GET `selectedCountToday`). */
    maxSelectedRelevancePerTickerPerDay: z
      .number()
      .int()
      .nonnegative()
      .optional(),
    /** Max `articleRelevances` rows per POST chunk. */
    postChunkArticleRelevanceBatchSize: z.number().int().positive().optional(),
    /**
     * When `failOnZeroSuccess` is true, require at least this many sources to complete extraction
     * (LLM + vocabulary) before POST (MP-ART-ANALYSIS-007).
     */
    runPolicy: articleAnalysisRunPolicySchema.optional(),
    /**
     * Retries after the first attempt for `analysis.create` when the API returns 429 or 5xx.
     */
    postTransientRetries: z.number().int().nonnegative().optional(),
    /** Initial backoff in ms; delay doubles each retry (`base * 2^attempt`). */
    postTransientRetryBaseDelayMs: z.number().int().positive().optional(),
    /**
     * Retries after the first LLM extraction attempt when a transient error is classified
     * (rate limit, empty completion, timeout, 5xx). 0 disables retries.
     */
    extractionTransientRetries: z.number().int().min(0).max(5).optional(),
    /** Initial backoff in ms for extraction retries (full-jitter exponential). */
    extractionTransientRetryBaseDelayMs: z.number().int().positive().optional(),
    /** Cap on jittered backoff in ms for extraction retries. */
    extractionTransientRetryMaxDelayMs: z.number().int().positive().optional(),
    /**
     * Per-call wall-clock timeout in ms applied to each `generateObject`/`generateText` attempt
     * (extraction, brainstorm, critique, repair). A stuck call aborts after this interval and is
     * retried by `executeLlmCallWithTransientRetries`. Default is generous — this is a hung-call
     * backstop, not a latency SLA.
     */
    extractionCallTimeoutMs: z.number().int().positive().optional(),
    /**
     * Cap on data sources loaded and processed per run
     * (also bounds `analysis.get` `limit` together with `analysisGetDataSourceLimitMax`).
     * Override in Hermes agent config; package default applies when omitted.
     */
    maxBatchSize: z.number().int().positive().optional(),
    /**
     * Max `analysis.get` `limit` (must not exceed `ANALYSIS_GET_DATA_SOURCE_LIMIT_MAX` from `@workspace/agent-data-api-contract`).
     * Actual limit is `min(maxBatchSize, analysisGetDataSourceLimitMax)`. Set in Hermes agent config JSON.
     */
    analysisGetDataSourceLimitMax: z
      .number()
      .int()
      .positive()
      .max(ANALYSIS_GET_DATA_SOURCE_LIMIT_MAX)
      .optional(),
    /**
     * When greater than zero, skip the run (success no-op) if GET returns fewer unanalyzed sources than this threshold.
     */
    debounceMinUnanalyzedCount: z.number().int().nonnegative().optional(),
    /**
     * When greater than zero, skip the run (success no-op) if any relevance was scored for this ticker within the last N minutes (requires GET `lastRelevanceScoredAtIso`).
     */
    debounceMinMinutesSinceLastScore: z.number().int().nonnegative().optional(),
    /**
     * Operator-supplied yield P50 baselines for regression warnings (not auto-computed from history).
     */
    yieldBaseline: z
      .object({
        extractionYieldP50: z.number().min(0).max(1).optional(),
        groundingYieldP50: z.number().min(0).max(1).optional(),
        vocabularyYieldP50: z.number().min(0).max(1).optional(),
      })
      .optional(),
  })
  .strict();

export type ArticleAnalysisConfig = z.infer<typeof articleAnalysisConfigSchema>;

/** Config with optional fields filled from {@link articleAnalysisConfigDefaults}. */
export type ResolvedArticleAnalysisConfig = ArticleAnalysisConfig & {
  openaiModel: string;
  maxContentChars: number;
  useStructureAwareTruncation: boolean;
  truncationLeadParagraphsAlwaysKept: number;
  truncationFinancialKeywordsExtra: string[];
  fewShotExemplarCount: number;
  fewShotExemplarArchetypes?: ExtractionExemplarArchetype[];
  useBrainstormPass: boolean;
  brainstormModel: string;
  /** Resolved reasoning effort for the extraction pass (falls back to `reasoningEffort`). */
  extractionReasoningEffort?: import("@workspace/agent-runtime").OpenAiReasoningEffort;
  /** Resolved reasoning effort for the brainstorm pass. */
  brainstormReasoningEffort?: import("@workspace/agent-runtime").OpenAiReasoningEffort;
  /** Resolved reasoning effort for the relation-critique pass. */
  relationCritiqueReasoningEffort?: import("@workspace/agent-runtime").OpenAiReasoningEffort;
  /** Resolved reasoning effort for the vocabulary-repair pass. */
  vocabularyRepairReasoningEffort?: import("@workspace/agent-runtime").OpenAiReasoningEffort;
  extractionConcurrency: number;
  runDeadlineMs?: number;
  useRelationSelfCritique: boolean;
  relationCritiqueDropFraction: number;
  relationCritiqueMinRelationCount: number;
  relationCritiqueModel: string;
  vocabularyPolicy: "strict" | "partition" | "repair";
  vocabularyRepairModel: string;
  vocabularyRepairMaxItems: number;
  entityGroundingPolicy: "drop" | "flag" | "off";
  entityGroundingMinTitleHits: number;
  maxEntitiesPerArticle: number;
  maxRelationsPerArticle: number;
  maxEntitiesPerRun: number;
  maxRelationsPerRun: number;
  postChunkRelationBatchSize: number;
  maxArticleEntitiesPerArticle: number;
  maxArticleEntitiesPerRun: number;
  postChunkArticleEntityBatchSize: number;
  scoreBreakdownVersion: number;
  relevanceWeightBreakingNews: number;
  relevanceWeightKgRelation: number;
  relevanceWeightFundamental: number;
  relevanceWeightTickerSalience: number;
  relevanceWeightSourceQuality: number;
  useSourceQualityV2: boolean;
  sourceQualityRecencyHalfLifeHours: number;
  sourceQualityHostTier1?: string[];
  sourceQualityHostTier2?: string[];
  sourceQualityHostTier3?: string[];
  useSelectionDiversification: boolean;
  selectionEntityOverlapThreshold: number;
  selectionTitleSimilarityThreshold: number;
  relevanceMinScore: number;
  maxSelectedRelevancePerTickerPerDay: number;
  postChunkArticleRelevanceBatchSize: number;
  runPolicy: ArticleAnalysisRunPolicy;
  postTransientRetries: number;
  postTransientRetryBaseDelayMs: number;
  extractionTransientRetries: number;
  extractionTransientRetryBaseDelayMs: number;
  extractionTransientRetryMaxDelayMs: number;
  extractionCallTimeoutMs: number;
  debounceMinUnanalyzedCount: number;
  debounceMinMinutesSinceLastScore: number;
  /** Cap on sources per run (Hermes agent config). */
  maxBatchSize: number;
  /** Upper bound for `analysis.get` `limit` (see `analysisGetDataSourceLimitMax` on Hermes config). */
  analysisGetDataSourceLimitMax: number;
};

/** Production-oriented defaults merged onto parsed Hermes config. */
export const articleAnalysisConfigDefaults = {
  openaiModel: "gpt-4o-mini",
  maxContentChars: 12_000,
  useStructureAwareTruncation: false,
  truncationLeadParagraphsAlwaysKept: 2,
  truncationFinancialKeywordsExtra: [],
  fewShotExemplarCount: 0,
  useBrainstormPass: false,
  extractionConcurrency: 1,
  useRelationSelfCritique: false,
  relationCritiqueDropFraction: 0.25,
  relationCritiqueMinRelationCount: 3,
  vocabularyPolicy: "strict",
  vocabularyRepairMaxItems: 20,
  entityGroundingPolicy: "off",
  entityGroundingMinTitleHits: 0,
  maxEntitiesPerArticle: 20,
  maxRelationsPerArticle: 20,
  maxEntitiesPerRun: 200,
  maxRelationsPerRun: 200,
  postChunkRelationBatchSize: 25,
  maxArticleEntitiesPerArticle: 30,
  maxArticleEntitiesPerRun: 500,
  postChunkArticleEntityBatchSize: 50,
  scoreBreakdownVersion: 1,
  relevanceWeightBreakingNews: 0.2,
  relevanceWeightKgRelation: 0.3,
  relevanceWeightFundamental: 0.05,
  relevanceWeightTickerSalience: 0.2,
  relevanceWeightSourceQuality: 0.25,
  useSourceQualityV2: false,
  sourceQualityRecencyHalfLifeHours: 72,
  useSelectionDiversification: false,
  selectionEntityOverlapThreshold: 0.5,
  selectionTitleSimilarityThreshold: 0.4,
  relevanceMinScore: 0.35,
  maxSelectedRelevancePerTickerPerDay: 10,
  postChunkArticleRelevanceBatchSize: 40,
  runPolicy: {
    minSuccessfulSources: 1,
    failOnZeroSuccess: true,
  },
  postTransientRetries: 0,
  postTransientRetryBaseDelayMs: 500,
  extractionTransientRetries: 2,
  extractionTransientRetryBaseDelayMs: 500,
  extractionTransientRetryMaxDelayMs: 8000,
  extractionCallTimeoutMs: 60_000,
  debounceMinUnanalyzedCount: 0,
  debounceMinMinutesSinceLastScore: 0,
  maxBatchSize: 10,
  analysisGetDataSourceLimitMax: ANALYSIS_GET_DATA_SOURCE_LIMIT_MAX,
} as const;

/**
 * Returns effective config with defaults applied for optional numeric/string fields,
 * including debounce knobs, `maxBatchSize`, and `analysisGetDataSourceLimitMax`
 * (Hermes config overrides or package defaults).
 *
 * @param config - Parsed Hermes config.
 * @returns Config safe to use at runtime.
 */
export const resolveArticleAnalysisConfig = (
  config: ArticleAnalysisConfig,
): ResolvedArticleAnalysisConfig => {
  const openaiModel =
    config.openaiModel ?? articleAnalysisConfigDefaults.openaiModel;
  const defaultEffort = config.reasoningEffort;

  return {
    ...config,
    openaiModel,
    maxContentChars:
      config.maxContentChars ?? articleAnalysisConfigDefaults.maxContentChars,
    useStructureAwareTruncation:
      config.useStructureAwareTruncation ??
      articleAnalysisConfigDefaults.useStructureAwareTruncation,
    truncationLeadParagraphsAlwaysKept:
      config.truncationLeadParagraphsAlwaysKept ??
      articleAnalysisConfigDefaults.truncationLeadParagraphsAlwaysKept,
    truncationFinancialKeywordsExtra:
      config.truncationFinancialKeywordsExtra ?? [
        ...articleAnalysisConfigDefaults.truncationFinancialKeywordsExtra,
      ],
    fewShotExemplarCount:
      config.fewShotExemplarCount ??
      articleAnalysisConfigDefaults.fewShotExemplarCount,
    ...(config.fewShotExemplarArchetypes !== undefined
      ? { fewShotExemplarArchetypes: config.fewShotExemplarArchetypes }
      : {}),
    useBrainstormPass:
      config.useBrainstormPass ??
      articleAnalysisConfigDefaults.useBrainstormPass,
    brainstormModel: config.brainstormModel ?? openaiModel,
    extractionConcurrency:
      config.extractionConcurrency ??
      articleAnalysisConfigDefaults.extractionConcurrency,
    ...(config.runDeadlineMs !== undefined
      ? { runDeadlineMs: config.runDeadlineMs }
      : {}),
    useRelationSelfCritique:
      config.useRelationSelfCritique ??
      articleAnalysisConfigDefaults.useRelationSelfCritique,
    relationCritiqueDropFraction:
      config.relationCritiqueDropFraction ??
      articleAnalysisConfigDefaults.relationCritiqueDropFraction,
    relationCritiqueMinRelationCount:
      config.relationCritiqueMinRelationCount ??
      articleAnalysisConfigDefaults.relationCritiqueMinRelationCount,
    relationCritiqueModel: config.relationCritiqueModel ?? openaiModel,
    vocabularyPolicy:
      config.vocabularyPolicy ?? articleAnalysisConfigDefaults.vocabularyPolicy,
    vocabularyRepairModel: config.vocabularyRepairModel ?? openaiModel,
    vocabularyRepairMaxItems:
      config.vocabularyRepairMaxItems ??
      articleAnalysisConfigDefaults.vocabularyRepairMaxItems,
    entityGroundingPolicy:
      config.entityGroundingPolicy ??
      articleAnalysisConfigDefaults.entityGroundingPolicy,
    entityGroundingMinTitleHits:
      config.entityGroundingMinTitleHits ??
      articleAnalysisConfigDefaults.entityGroundingMinTitleHits,
    maxEntitiesPerArticle:
      config.maxEntitiesPerArticle ??
      articleAnalysisConfigDefaults.maxEntitiesPerArticle,
    maxRelationsPerArticle:
      config.maxRelationsPerArticle ??
      articleAnalysisConfigDefaults.maxRelationsPerArticle,
    maxEntitiesPerRun:
      config.maxEntitiesPerRun ??
      articleAnalysisConfigDefaults.maxEntitiesPerRun,
    maxRelationsPerRun:
      config.maxRelationsPerRun ??
      articleAnalysisConfigDefaults.maxRelationsPerRun,
    postChunkRelationBatchSize:
      config.postChunkRelationBatchSize ??
      articleAnalysisConfigDefaults.postChunkRelationBatchSize,
    maxArticleEntitiesPerArticle:
      config.maxArticleEntitiesPerArticle ??
      articleAnalysisConfigDefaults.maxArticleEntitiesPerArticle,
    maxArticleEntitiesPerRun:
      config.maxArticleEntitiesPerRun ??
      articleAnalysisConfigDefaults.maxArticleEntitiesPerRun,
    postChunkArticleEntityBatchSize:
      config.postChunkArticleEntityBatchSize ??
      articleAnalysisConfigDefaults.postChunkArticleEntityBatchSize,
    scoreBreakdownVersion:
      config.scoreBreakdownVersion ??
      articleAnalysisConfigDefaults.scoreBreakdownVersion,
    relevanceWeightBreakingNews:
      config.relevanceWeightBreakingNews ??
      articleAnalysisConfigDefaults.relevanceWeightBreakingNews,
    relevanceWeightKgRelation:
      config.relevanceWeightKgRelation ??
      articleAnalysisConfigDefaults.relevanceWeightKgRelation,
    relevanceWeightFundamental:
      config.relevanceWeightFundamental ??
      articleAnalysisConfigDefaults.relevanceWeightFundamental,
    relevanceWeightTickerSalience:
      config.relevanceWeightTickerSalience ??
      articleAnalysisConfigDefaults.relevanceWeightTickerSalience,
    relevanceWeightSourceQuality:
      config.relevanceWeightSourceQuality ??
      articleAnalysisConfigDefaults.relevanceWeightSourceQuality,
    useSourceQualityV2:
      config.useSourceQualityV2 ??
      articleAnalysisConfigDefaults.useSourceQualityV2,
    sourceQualityRecencyHalfLifeHours:
      config.sourceQualityRecencyHalfLifeHours ??
      articleAnalysisConfigDefaults.sourceQualityRecencyHalfLifeHours,
    ...(config.sourceQualityHostTier1 !== undefined
      ? { sourceQualityHostTier1: config.sourceQualityHostTier1 }
      : {}),
    ...(config.sourceQualityHostTier2 !== undefined
      ? { sourceQualityHostTier2: config.sourceQualityHostTier2 }
      : {}),
    ...(config.sourceQualityHostTier3 !== undefined
      ? { sourceQualityHostTier3: config.sourceQualityHostTier3 }
      : {}),
    useSelectionDiversification:
      config.useSelectionDiversification ??
      articleAnalysisConfigDefaults.useSelectionDiversification,
    selectionEntityOverlapThreshold:
      config.selectionEntityOverlapThreshold ??
      articleAnalysisConfigDefaults.selectionEntityOverlapThreshold,
    selectionTitleSimilarityThreshold:
      config.selectionTitleSimilarityThreshold ??
      articleAnalysisConfigDefaults.selectionTitleSimilarityThreshold,
    relevanceMinScore:
      config.relevanceMinScore ??
      articleAnalysisConfigDefaults.relevanceMinScore,
    maxSelectedRelevancePerTickerPerDay:
      config.maxSelectedRelevancePerTickerPerDay ??
      articleAnalysisConfigDefaults.maxSelectedRelevancePerTickerPerDay,
    postChunkArticleRelevanceBatchSize:
      config.postChunkArticleRelevanceBatchSize ??
      articleAnalysisConfigDefaults.postChunkArticleRelevanceBatchSize,
    runPolicy: {
      minSuccessfulSources:
        config.runPolicy?.minSuccessfulSources ??
        articleAnalysisConfigDefaults.runPolicy.minSuccessfulSources,
      failOnZeroSuccess:
        config.runPolicy?.failOnZeroSuccess ??
        articleAnalysisConfigDefaults.runPolicy.failOnZeroSuccess,
    },
    postTransientRetries:
      config.postTransientRetries ??
      articleAnalysisConfigDefaults.postTransientRetries,
    postTransientRetryBaseDelayMs:
      config.postTransientRetryBaseDelayMs ??
      articleAnalysisConfigDefaults.postTransientRetryBaseDelayMs,
    extractionTransientRetries:
      config.extractionTransientRetries ??
      articleAnalysisConfigDefaults.extractionTransientRetries,
    extractionTransientRetryBaseDelayMs:
      config.extractionTransientRetryBaseDelayMs ??
      articleAnalysisConfigDefaults.extractionTransientRetryBaseDelayMs,
    extractionTransientRetryMaxDelayMs:
      config.extractionTransientRetryMaxDelayMs ??
      articleAnalysisConfigDefaults.extractionTransientRetryMaxDelayMs,
    extractionCallTimeoutMs:
      config.extractionCallTimeoutMs ??
      articleAnalysisConfigDefaults.extractionCallTimeoutMs,
    debounceMinUnanalyzedCount:
      config.debounceMinUnanalyzedCount ??
      articleAnalysisConfigDefaults.debounceMinUnanalyzedCount,
    debounceMinMinutesSinceLastScore:
      config.debounceMinMinutesSinceLastScore ??
      articleAnalysisConfigDefaults.debounceMinMinutesSinceLastScore,
    maxBatchSize:
      config.maxBatchSize ?? articleAnalysisConfigDefaults.maxBatchSize,
    analysisGetDataSourceLimitMax:
      config.analysisGetDataSourceLimitMax ??
      articleAnalysisConfigDefaults.analysisGetDataSourceLimitMax,
    // Reasoning effort: per-pass overrides fall back to the agent-wide default.
    // All values remain undefined when the operator has not set reasoning effort
    // (safe for non-reasoning models such as gpt-4o-mini).
    ...(config.extractionReasoningEffort !== undefined
      ? { extractionReasoningEffort: config.extractionReasoningEffort }
      : defaultEffort !== undefined
        ? { extractionReasoningEffort: defaultEffort }
        : {}),
    ...(config.brainstormReasoningEffort !== undefined
      ? { brainstormReasoningEffort: config.brainstormReasoningEffort }
      : defaultEffort !== undefined
        ? { brainstormReasoningEffort: defaultEffort }
        : {}),
    ...(config.relationCritiqueReasoningEffort !== undefined
      ? {
          relationCritiqueReasoningEffort:
            config.relationCritiqueReasoningEffort,
        }
      : defaultEffort !== undefined
        ? { relationCritiqueReasoningEffort: defaultEffort }
        : {}),
    ...(config.vocabularyRepairReasoningEffort !== undefined
      ? {
          vocabularyRepairReasoningEffort:
            config.vocabularyRepairReasoningEffort,
        }
      : defaultEffort !== undefined
        ? { vocabularyRepairReasoningEffort: defaultEffort }
        : {}),
  };
};

/**
 * Maps resolved Hermes relevance weights into the v1 weight map used by scoring.
 *
 * @param cfg - Fully resolved article-analysis config.
 * @returns Weights for canonical breakdown keys.
 */
export const toRelevanceWeightMapV1 = (
  cfg: ResolvedArticleAnalysisConfig,
): RelevanceWeightMapV1 => ({
  breakingNews: cfg.relevanceWeightBreakingNews,
  kgRelation: cfg.relevanceWeightKgRelation,
  fundamental: cfg.relevanceWeightFundamental,
  tickerSalience: cfg.relevanceWeightTickerSalience,
  sourceQuality: cfg.relevanceWeightSourceQuality,
});
