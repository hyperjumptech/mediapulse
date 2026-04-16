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
  };
};
