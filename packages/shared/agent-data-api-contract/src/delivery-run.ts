import { z } from "zod";

export const deliveryRunOutcomeSchema = z.enum([
  "success",
  "skipped",
  "failed",
  "partial_success",
]);

export const deliveryRunStageSchema = z.enum([
  "fetch",
  "render",
  "send",
  "persist_delivery_record",
]);

export const deliveryRecipientOutcomeInputSchema = z.object({
  userTickerId: z.string().uuid(),
  status: z.enum(["success", "failed", "skipped"]),
  attempts: z.number().int().nonnegative(),
  lastErrorCode: z.string().nullable().optional(),
  lastErrorMessage: z.string().nullable().optional(),
  errorCategory: z.string().nullable().optional(),
  resendEmailId: z.string().nullable().optional(),
});

export const postDeliveryRunBodySchema = z.object({
  id: z.string().uuid(),
  agentId: z.string().min(1),
  agentVersion: z.string().min(1),
  tickerId: z.string().uuid(),
  newsletterId: z.string().uuid().nullable().optional(),
  outcome: deliveryRunOutcomeSchema,
  stage: deliveryRunStageSchema.nullable().optional(),
  successCount: z.number().int().nonnegative(),
  failureCount: z.number().int().nonnegative(),
  skippedCount: z.number().int().nonnegative(),
  durationMs: z.number().int().nonnegative(),
  scheduleExecutionId: z.string().nullable().optional(),
  hermesScheduleId: z.string().nullable().optional(),
  pipelineStepId: z.string().nullable().optional(),
  jobId: z.string().nullable().optional(),
  hermesExecutionId: z.string().nullable().optional(),
  runSkipReason: z.string().nullable().optional(),
  resendMessageIds: z.array(z.string()).optional(),
  recipientErrorSummary: z.string().nullable().optional(),
  recipients: z.array(deliveryRecipientOutcomeInputSchema),
  createdAt: z.string().datetime(),
});

export const postDeliveryRunResponseSchema = z.object({
  message: z.string(),
});

export const deliveryRunQuerySchema = z.object({
  tickerId: z.preprocess(
    (v) => (v === "" || v === undefined ? undefined : v),
    z.string().uuid().optional(),
  ),
  outcome: z.preprocess(
    (v) => (v === "" || v === undefined ? undefined : v),
    deliveryRunOutcomeSchema.optional(),
  ),
  start: z.preprocess(
    (v) => (v === "" || v === undefined ? undefined : v),
    z.string().datetime().optional(),
  ),
  end: z.preprocess(
    (v) => (v === "" || v === undefined ? undefined : v),
    z.string().datetime().optional(),
  ),
});

export const deliveryRunListItemSchema = z.object({
  id: z.string().uuid(),
  agentId: z.string(),
  agentVersion: z.string(),
  tickerId: z.string().uuid(),
  tickerSymbol: z.string().optional(),
  newsletterId: z.string().uuid().nullable().optional(),
  outcome: deliveryRunOutcomeSchema,
  stage: deliveryRunStageSchema.nullable().optional(),
  successCount: z.number().int(),
  failureCount: z.number().int(),
  skippedCount: z.number().int(),
  durationMs: z.number().int(),
  scheduleExecutionId: z.string().nullable().optional(),
  hermesScheduleId: z.string().nullable().optional(),
  pipelineStepId: z.string().nullable().optional(),
  jobId: z.string().nullable().optional(),
  hermesExecutionId: z.string().nullable().optional(),
  runSkipReason: z.string().nullable().optional(),
  recipientErrorSummary: z.string().nullable().optional(),
  createdAt: z.string().datetime(),
});

export const getDeliveryRunResponseSchema = z.object({
  data: z.array(deliveryRunListItemSchema),
});

export type PostDeliveryRunBody = z.infer<typeof postDeliveryRunBodySchema>;
export type PostDeliveryRunResponse = z.infer<
  typeof postDeliveryRunResponseSchema
>;
export type DeliveryRunQuery = z.infer<typeof deliveryRunQuerySchema>;
export type GetDeliveryRunResponse = z.infer<
  typeof getDeliveryRunResponseSchema
>;
export type DeliveryRecipientOutcomeInput = z.infer<
  typeof deliveryRecipientOutcomeInputSchema
>;
