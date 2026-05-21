import { hermesTickerIdSchema } from "@workspace/agent-runtime";
import { z } from "zod";

/**
 * Hermes run input for the article-analysis agent.
 *
 * Runs are always incremental (`unanalyzed: true` on analysis GET). Batch size and
 * extraction tuning live in Hermes agent config, not per-run input.
 */
export const articleAnalysisInputSchema = z
  .object({
    tickerId: hermesTickerIdSchema,
  })
  .strict();

export type ArticleAnalysisInput = z.infer<typeof articleAnalysisInputSchema>;
