import { ANALYSIS_GET_DATA_SOURCE_LIMIT_MAX } from "@workspace/agent-data-api-contract";
import type { RelevanceWeightMapV1 } from "./analysis-relevance-scoring.js";
import type { ArticleAnalysisRunPolicy } from "./article-analysis-run-policy.js";
import {
  ARTICLE_ANALYSIS_EXTRACTION_SYSTEM_PROMPT_PLACEHOLDERS,
  ARTICLE_ANALYSIS_EXTRACTION_USER_PROMPT_PLACEHOLDERS,
  ARTICLE_ANALYSIS_LLM_PROMPT_FIELD_MAX_LENGTH,
} from "./article-extraction-prompt-defaults.js";
import { findUnknownLlmPromptPlaceholderTokens } from "@workspace/agent-llm-prompt-template";
import { z } from "zod";

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
    /** Stored in `scoreBreakdown._version` (must match Hermes when bumping breakdown schema). */
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
     * When Hermes run input omits `maxBatchSize`, cap how many data sources are loaded and processed per run
     * (also bounds `analysis.get` `limit` together with `analysisGetDataSourceLimitMax`).
     * Override in Hermes agent config; package default applies when omitted.
     */
    defaultMaxBatchSize: z.number().int().positive().optional(),
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
     * Optional overrides for extraction LLM system/user wording (Hermes agent config).
     * Defaults remain in code; merge is `configured ?? default` before each extraction call.
     * Do not put API keys or other secrets in prompt strings.
     */
    prompts: z
      .object({
        systemPrompt: z
          .string()
          .max(ARTICLE_ANALYSIS_LLM_PROMPT_FIELD_MAX_LENGTH, {
            message: `prompts.systemPrompt must be at most ${String(ARTICLE_ANALYSIS_LLM_PROMPT_FIELD_MAX_LENGTH)} characters`,
          })
          .describe(
            "Optional full system prompt for entity extraction. When omitted, a built-in default is used. Supported placeholders: {{entityTypesBlock}}, {{relationTypesBlock}} (vocabulary from analysis GET).",
          )
          .optional(),
        userPromptTemplate: z
          .string()
          .max(ARTICLE_ANALYSIS_LLM_PROMPT_FIELD_MAX_LENGTH, {
            message: `prompts.userPromptTemplate must be at most ${String(ARTICLE_ANALYSIS_LLM_PROMPT_FIELD_MAX_LENGTH)} characters`,
          })
          .describe(
            "Optional user message template for extraction. Supported placeholders: {{tickerId}}, {{title}}, {{articleContent}} (truncated article body per maxContentChars).",
          )
          .optional(),
      })
      .strict()
      .optional(),
  })
  .superRefine((data, ctx) => {
    const prompts = data.prompts;
    if (!prompts) {
      return;
    }
    const systemAllowed = new Set<string>(
      ARTICLE_ANALYSIS_EXTRACTION_SYSTEM_PROMPT_PLACEHOLDERS,
    );
    const userAllowed = new Set<string>(
      ARTICLE_ANALYSIS_EXTRACTION_USER_PROMPT_PLACEHOLDERS,
    );
    if (prompts.systemPrompt) {
      for (const token of findUnknownLlmPromptPlaceholderTokens(
        prompts.systemPrompt,
        systemAllowed,
      )) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Unknown placeholder {{${token}}} in prompts.systemPrompt`,
          path: ["prompts", "systemPrompt"],
        });
      }
    }
    if (prompts.userPromptTemplate) {
      for (const token of findUnknownLlmPromptPlaceholderTokens(
        prompts.userPromptTemplate,
        userAllowed,
      )) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Unknown placeholder {{${token}}} in prompts.userPromptTemplate`,
          path: ["prompts", "userPromptTemplate"],
        });
      }
    }
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
  runPolicy: ArticleAnalysisRunPolicy;
  postTransientRetries: number;
  postTransientRetryBaseDelayMs: number;
  debounceMinUnanalyzedCount: number;
  debounceMinMinutesSinceLastScore: number;
  /** Cap on sources per run when Hermes input omits `maxBatchSize`. */
  defaultMaxBatchSize: number;
  /** Upper bound for `analysis.get` `limit` (see `analysisGetDataSourceLimitMax` on Hermes config). */
  analysisGetDataSourceLimitMax: number;
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
  runPolicy: {
    minSuccessfulSources: 1,
    failOnZeroSuccess: true,
  },
  postTransientRetries: 0,
  postTransientRetryBaseDelayMs: 500,
  debounceMinUnanalyzedCount: 0,
  debounceMinMinutesSinceLastScore: 0,
  defaultMaxBatchSize: 10,
  analysisGetDataSourceLimitMax: ANALYSIS_GET_DATA_SOURCE_LIMIT_MAX,
} as const;

/**
 * Returns effective config with defaults applied for optional numeric/string fields,
 * including debounce knobs, `defaultMaxBatchSize`, and `analysisGetDataSourceLimitMax`
 * (Hermes config overrides or package defaults).
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
    debounceMinUnanalyzedCount:
      config.debounceMinUnanalyzedCount ??
      articleAnalysisConfigDefaults.debounceMinUnanalyzedCount,
    debounceMinMinutesSinceLastScore:
      config.debounceMinMinutesSinceLastScore ??
      articleAnalysisConfigDefaults.debounceMinMinutesSinceLastScore,
    defaultMaxBatchSize:
      config.defaultMaxBatchSize ??
      articleAnalysisConfigDefaults.defaultMaxBatchSize,
    analysisGetDataSourceLimitMax:
      config.analysisGetDataSourceLimitMax ??
      articleAnalysisConfigDefaults.analysisGetDataSourceLimitMax,
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
