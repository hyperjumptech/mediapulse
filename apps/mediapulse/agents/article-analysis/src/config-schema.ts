import type { RelevanceWeightMapV1 } from "./analysis-relevance-scoring.js";
import { z } from "zod";

/**
 * Hermes agent config for article-analysis (extraction, caps, chunking).
 * Placeholder numeric defaults until MP-ART-ANALYSIS-009 env alignment.
 */
export const articleAnalysisConfigSchema = z.object({
  verbose: z.boolean().optional(),
  /** OpenAI-compatible API key for structured extraction. */
  openaiApiKey: z.string().min(1),
  /** Chat model id (e.g. `gpt-4o-mini`). */
  openaiModel: z.string().min(1).optional(),
  /** Max output tokens for `generateObject`. */
  maxOutputTokens: z.number().int().positive().optional(),
  /** Truncate article text in the LLM user message (full text remains in DB). */
  maxContentChars: z.number().int().positive().optional(),
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
  /** Stored in `scoreBreakdown._version` (MP-ART-ANALYSIS-009 env mirror later). */
  scoreBreakdownVersion: z.number().int().min(1).optional(),
  relevanceWeightBreakingNews: z.number().nonnegative().optional(),
  relevanceWeightKgRelation: z.number().nonnegative().optional(),
  relevanceWeightFundamental: z.number().nonnegative().optional(),
  relevanceWeightTickerSalience: z.number().nonnegative().optional(),
  relevanceWeightSourceQuality: z.number().nonnegative().optional(),
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
});

export type ArticleAnalysisConfig = z.infer<typeof articleAnalysisConfigSchema>;

/** Config with optional fields filled from {@link articleAnalysisConfigDefaults}. */
export type ResolvedArticleAnalysisConfig = ArticleAnalysisConfig & {
  openaiModel: string;
  maxOutputTokens: number;
  maxContentChars: number;
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
  relevanceMinScore: number;
  maxSelectedRelevancePerTickerPerDay: number;
  postChunkArticleRelevanceBatchSize: number;
};

/** Production-oriented defaults merged onto parsed Hermes config. */
export const articleAnalysisConfigDefaults = {
  openaiModel: "gpt-4o-mini",
  maxOutputTokens: 8192,
  maxContentChars: 12_000,
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
  relevanceWeightKgRelation: 0.2,
  relevanceWeightFundamental: 0.2,
  relevanceWeightTickerSalience: 0.2,
  relevanceWeightSourceQuality: 0.2,
  relevanceMinScore: 0.35,
  maxSelectedRelevancePerTickerPerDay: 10,
  postChunkArticleRelevanceBatchSize: 40,
} as const;

/**
 * Returns effective config with defaults applied for optional numeric/string fields.
 *
 * @param config - Parsed Hermes config.
 * @returns Config safe to use at runtime.
 */
export const resolveArticleAnalysisConfig = (
  config: ArticleAnalysisConfig,
): ResolvedArticleAnalysisConfig => {
  return {
    ...config,
    openaiModel:
      config.openaiModel ?? articleAnalysisConfigDefaults.openaiModel,
    maxOutputTokens:
      config.maxOutputTokens ?? articleAnalysisConfigDefaults.maxOutputTokens,
    maxContentChars:
      config.maxContentChars ?? articleAnalysisConfigDefaults.maxContentChars,
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
    relevanceMinScore:
      config.relevanceMinScore ??
      articleAnalysisConfigDefaults.relevanceMinScore,
    maxSelectedRelevancePerTickerPerDay:
      config.maxSelectedRelevancePerTickerPerDay ??
      articleAnalysisConfigDefaults.maxSelectedRelevancePerTickerPerDay,
    postChunkArticleRelevanceBatchSize:
      config.postChunkArticleRelevanceBatchSize ??
      articleAnalysisConfigDefaults.postChunkArticleRelevanceBatchSize,
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
