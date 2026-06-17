import { hermesTickerIdSchema } from "@workspace/agent-runtime";
import { z } from "zod";

/**
 * Hermes run input for the article-analysis agent.
 *
 * Default (global backlog): omit `tickerId` to process page-collection articles and infer
 * tickers per article. Legacy ticker-scoped runs pass `tickerId`.
 *
 * Runs are always incremental (`unanalyzed: true` on analysis GET). Batch size and
 * extraction tuning live in Hermes agent config; optional `limit` caps the GET page size.
 */
export const articleAnalysisInputSchema = z
  .object({
    /** Legacy ticker-scoped mode; omit for global page-collection backlog. */
    tickerId: hermesTickerIdSchema.optional(),
    /** Optional cap on analysis GET `limit` (also bounded by Hermes config). */
    limit: z.number().int().positive().optional(),
  })
  .strict();

export type ArticleAnalysisInput = z.infer<typeof articleAnalysisInputSchema>;
