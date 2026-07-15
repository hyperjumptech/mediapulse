import { z } from "zod";

export const articleAnalysisRunStatusSchema = z.enum([
  "success",
  "partial_success",
  "failed",
]);

export const articleAnalysisRunInputSchema = z.object({
  id: z.string().uuid(),
  tickerId: z.string().trim().min(1).optional(),
  scheduleExecutionId: z.string().uuid().optional(),
  startedAt: z.string().datetime(),
  completedAt: z.string().datetime(),
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
});

export const postArticleAnalysisRunBodySchema = articleAnalysisRunInputSchema;

export const postArticleAnalysisRunResponseSchema = z.object({
  message: z.string(),
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
