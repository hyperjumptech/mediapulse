import { z } from "zod";

/**
 * Ticker id used by the query-analysis chronicle.
 *
 * Aligns with Hermes agent input semantics: accept any non-empty trimmed string,
 * including UUIDs and opaque ids.
 */
const queryAnalysisRunTickerIdSchema = z.string().trim().min(1);

/** One generated query with its final include/reject decision and the reason. */
export const queryDecisionSchema = z.object({
  text: z.string(),
  included: z.boolean(),
  reason: z.string(),
});

export const postQueryAnalysisRunBodySchema = z.object({
  tickerId: queryAnalysisRunTickerIdSchema,
  /** Hermes execution id that produced this run (`hermesCorrelation.executionId`). */
  executionId: z.string().nullable().optional(),
  queries: z.array(queryDecisionSchema),
});

export const postQueryAnalysisRunResponseSchema = z.object({
  id: z.string().uuid(),
  tickerId: queryAnalysisRunTickerIdSchema,
  executionId: z.string().nullable().optional(),
  queries: z.array(queryDecisionSchema),
  createdAt: z.string().datetime(),
});

export type QueryDecision = z.infer<typeof queryDecisionSchema>;
export type PostQueryAnalysisRunBody = z.infer<
  typeof postQueryAnalysisRunBodySchema
>;
export type PostQueryAnalysisRunResponse = z.infer<
  typeof postQueryAnalysisRunResponseSchema
>;
