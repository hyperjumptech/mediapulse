/**
 * Run policy, per-source extraction failures, and POST failure records for article-analysis (MP-ART-ANALYSIS-007, #217).
 */

/** Stage at which per-source extraction stopped. */
export type ArticleAnalysisExtractionFailureStage =
  | "llm"
  | "vocabulary"
  | "prefilter";

/** Fine-grained cause of a `stage: "llm"` non-response. */
export type ExtractionLlmFailureReason =
  | "length_truncation"
  | "empty_stop"
  | "content_filter"
  | "timeout"
  | "other";

/** One source that did not contribute to the merged extraction payload. */
export type ArticleAnalysisExtractionFailureRecord = {
  dataSourceId: string;
  stage: ArticleAnalysisExtractionFailureStage;
  message: string;
  /** Fine-grained cause for `stage: "llm"` failures — distinguishes starvation from model degradation. */
  reason?: ExtractionLlmFailureReason;
  /** Actual output tokens reported by the provider when truncation occurred. */
  outputTokens?: number;
  /** The `maxOutputTokens` cap that was active on the truncated attempt. */
  maxOutputTokens?: number;
};

/** POST phase labels aligned with `run.ts` logging. */
export type ArticleAnalysisPostChunkKind =
  | "entities_relations"
  | "article_entities"
  | "article_relevances";

/** One failed `analysis.create` chunk (FR7 diagnostics). */
export type ArticleAnalysisPostFailureRecord = {
  chunkKind: ArticleAnalysisPostChunkKind;
  chunkIndex: number;
  errorCategory: "agent_data_api_http" | "unknown";
  httpStatus?: number;
  message: string;
};

/** Hermes-configurable policy mirroring data-collection `runPolicy` semantics. */
export type ArticleAnalysisRunPolicy = {
  minSuccessfulSources: number;
  failOnZeroSuccess: boolean;
};

/** Outcome label for Hermes / observability when some work failed but the run is semantically OK. */
export type ArticleAnalysisRunStatusLabel = "success" | "partial_success";

/**
 * Whether the run must fail before POST because too few sources produced a successful extraction.
 *
 * @param extractionSuccessCount - Sources that passed LLM + vocabulary for this batch.
 * @param policy - Resolved Hermes run policy.
 * @returns True when the run should return `success: false` (semantic failure).
 */
export const isArticleAnalysisExtractionPolicyFailure = (
  extractionSuccessCount: number,
  policy: ArticleAnalysisRunPolicy,
): boolean =>
  policy.failOnZeroSuccess &&
  extractionSuccessCount < policy.minSuccessfulSources;

/**
 * Derives HTTP 200 envelope run status from extraction and POST failure counts.
 *
 * @param extractionFailureCount - Number of per-source extraction failures recorded.
 * @param postFailureCount - Number of failed `analysis.create` calls.
 * @returns `partial_success` if any failure was recorded; otherwise `success`.
 */
export const deriveArticleAnalysisRunStatusLabel = (
  extractionFailureCount: number,
  postFailureCount: number,
): ArticleAnalysisRunStatusLabel =>
  extractionFailureCount > 0 || postFailureCount > 0
    ? "partial_success"
    : "success";
