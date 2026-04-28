import { z } from "zod";

export const contentGenerationRunOutcomeSchema = z.enum([
  "success",
  "skipped",
  "failed",
]);

export const contentGenerationRunStageSchema = z.enum([
  "precheck",
  "llm",
  "validate",
  "persist",
]);

/**
 * Ticker id used by content-generation diagnostics.
 *
 * Aligns with Hermes agent input semantics (`hermesTickerIdSchema`): accept any
 * non-empty trimmed string, including UUIDs and opaque ids.
 */
const contentGenerationRunTickerIdSchema = z.string().trim().min(1);

export const postContentGenerationRunBodySchema = z.object({
  agentId: z.literal("content-generation"),
  agentVersion: z.string().min(1),
  tickerId: contentGenerationRunTickerIdSchema,
  outcome: contentGenerationRunOutcomeSchema,
  stage: contentGenerationRunStageSchema.nullable().optional(),
  errorCode: z.string().nullable().optional(),
  errorCategory: z.string().nullable().optional(),
  message: z.string().nullable().optional(),
  durationMs: z.number().int().nonnegative().nullable().optional(),
  pipelineRunId: z.string().nullable().optional(),
  executionId: z.string().nullable().optional(),
  newsletterId: z.string().uuid().nullable().optional(),
});

export const postContentGenerationRunResponseSchema = z.object({
  id: z.string().uuid(),
  agentId: z.string(),
  agentVersion: z.string(),
  tickerId: contentGenerationRunTickerIdSchema,
  outcome: contentGenerationRunOutcomeSchema,
  stage: contentGenerationRunStageSchema.nullable().optional(),
  errorCode: z.string().nullable().optional(),
  errorCategory: z.string().nullable().optional(),
  message: z.string().nullable().optional(),
  durationMs: z.number().int().nullable().optional(),
  pipelineRunId: z.string().nullable().optional(),
  executionId: z.string().nullable().optional(),
  newsletterId: z.string().uuid().nullable().optional(),
  createdAt: z.string().datetime(),
});

export const contentGenerationRunQuerySchema = z.object({
  cursor: z.preprocess(
    (v) => (v === "" || v === undefined ? undefined : v),
    z.string().uuid().optional(),
  ),
  limit: z.preprocess(
    (v) => (v === undefined || v === "" ? undefined : Number(v)),
    z.number().int().min(1).max(100).optional(),
  ),
  tickerId: z.preprocess(
    (v) => (v === "" || v === undefined ? undefined : v),
    contentGenerationRunTickerIdSchema.optional(),
  ),
  outcome: z.preprocess(
    (v) => (v === "" || v === undefined ? undefined : v),
    contentGenerationRunOutcomeSchema.optional(),
  ),
  startTime: z.preprocess(
    (v) => (v === "" || v === undefined ? undefined : v),
    z.string().datetime().optional(),
  ),
  endTime: z.preprocess(
    (v) => (v === "" || v === undefined ? undefined : v),
    z.string().datetime().optional(),
  ),
});

export const contentGenerationRunListItemSchema = z.object({
  id: z.string().uuid(),
  agentId: z.string(),
  agentVersion: z.string(),
  tickerId: contentGenerationRunTickerIdSchema,
  outcome: contentGenerationRunOutcomeSchema,
  stage: contentGenerationRunStageSchema.nullable().optional(),
  errorCode: z.string().nullable().optional(),
  errorCategory: z.string().nullable().optional(),
  message: z.string().nullable().optional(),
  durationMs: z.number().int().nullable().optional(),
  pipelineRunId: z.string().nullable().optional(),
  executionId: z.string().nullable().optional(),
  newsletterId: z.string().uuid().nullable().optional(),
  createdAt: z.string().datetime(),
});

export const getContentGenerationRunResponseSchema = z.object({
  data: z.array(contentGenerationRunListItemSchema),
  nextCursor: z.string().optional(),
});

export type ContentGenerationRunOutcome = z.infer<
  typeof contentGenerationRunOutcomeSchema
>;
export type ContentGenerationRunStage = z.infer<
  typeof contentGenerationRunStageSchema
>;
export type PostContentGenerationRunBody = z.infer<
  typeof postContentGenerationRunBodySchema
>;
export type PostContentGenerationRunResponse = z.infer<
  typeof postContentGenerationRunResponseSchema
>;
export type ContentGenerationRunQuery = z.infer<
  typeof contentGenerationRunQuerySchema
>;
export type ContentGenerationRunListItem = z.infer<
  typeof contentGenerationRunListItemSchema
>;
export type GetContentGenerationRunResponse = z.infer<
  typeof getContentGenerationRunResponseSchema
>;
