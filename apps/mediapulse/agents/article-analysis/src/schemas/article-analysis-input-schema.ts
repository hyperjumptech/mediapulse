import { hermesTickerIdSchema } from "@workspace/agent-runtime";
import { z } from "zod";

const timeWindowSchema = z
  .object({
    start: z.string().datetime().optional(),
    end: z.string().datetime().optional(),
  })
  .optional();

/**
 * Hermes run input for the article-analysis agent (Phase A: context load and batch bounds only).
 *
 * When `reanalyze` is true, callers must supply `maxBatchSize` and/or a `timeWindow` with at least
 * one of `start` or `end` (ISO 8601), matching MP-ART-ANALYSIS-003 / FR1.
 */
export const articleAnalysisInputSchema = z
  .object({
    tickerId: hermesTickerIdSchema,
    reanalyze: z.boolean().optional(),
    timeWindow: timeWindowSchema,
    maxBatchSize: z.number().int().positive().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.reanalyze !== true) {
      return;
    }
    const hasWindow =
      data.timeWindow?.start !== undefined ||
      data.timeWindow?.end !== undefined;
    const hasCap = data.maxBatchSize !== undefined;
    if (!hasWindow && !hasCap) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "reanalyze requires maxBatchSize and/or timeWindow with start or end",
        path: ["reanalyze"],
      });
    }
  });

export type ArticleAnalysisInput = z.infer<typeof articleAnalysisInputSchema>;
