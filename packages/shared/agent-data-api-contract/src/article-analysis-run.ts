import { z } from "zod";

export const articleAnalysisRunStatusSchema = z.enum([
  "running",
  "success",
  "partial_success",
  "failed",
]);

export const articleAnalysisRunInputSchema = z.object({
  id: z.string().uuid(),
  tickerId: z.string().trim().min(1).optional(),
  scheduleExecutionId: z.string().uuid().optional(),
  startedAt: z.string().datetime(),
  /** Absent while the run is still in flight; set when it reaches a terminal status. */
  completedAt: z.string().datetime().optional(),
  status: articleAnalysisRunStatusSchema,
  /** Classification LLM model id. */
  model: z.string().optional(),
  /** Article-analysis agent version that produced this run. */
  agentVersion: z.string().optional(),
  promptTokens: z.number().int().nonnegative().default(0),
  completionTokens: z.number().int().nonnegative().default(0),
  reasoningTokens: z.number().int().nonnegative().default(0),
  totalTokens: z.number().int().nonnegative().default(0),
  /** (article, ticker) pairs classified into a section this run. */
  scored: z.number().int().nonnegative().default(0),
  /** Pairs classified as rejected (no section) this run. */
  rejected: z.number().int().nonnegative().default(0),
  /** Remaining unanalyzed pairs after this run. */
  backlog: z.number().int().nonnegative().default(0),
  stopReason: z.string().optional(),
  durationMs: z.number().int().nonnegative().optional(),
  /**
   * Marks any run still `running` that started before this instant as `failed` with a `stalled`
   * stop reason, before this run's own row is written. A `running` row older than the agent's
   * timeout is a crashed run, which the schema cannot otherwise tell apart from a live one.
   */
  stalledBefore: z.string().datetime().optional(),
});

export const postArticleAnalysisRunBodySchema = articleAnalysisRunInputSchema;

export const postArticleAnalysisRunResponseSchema = z.object({
  message: z.string(),
  /** Runs marked failed as stalled by this request, when `stalledBefore` was supplied. */
  stalledCount: z.number().int().nonnegative().optional(),
});

export const getArticleAnalysisRunResponseSchema = z.object({
  data: z.array(articleAnalysisRunInputSchema),
});

export const articleAnalysisRunQuerySchema = z.object({
  tickerId: z.string().trim().min(1).optional(),
  start: z.string().datetime().optional(),
  end: z.string().datetime().optional(),
});

export type ArticleAnalysisRunBody = z.infer<
  typeof postArticleAnalysisRunBodySchema
>;
export type PostArticleAnalysisRunResponse = z.infer<
  typeof postArticleAnalysisRunResponseSchema
>;
export type GetArticleAnalysisRunResponse = z.infer<
  typeof getArticleAnalysisRunResponseSchema
>;
export type ArticleAnalysisRunQuery = z.infer<
  typeof articleAnalysisRunQuerySchema
>;
