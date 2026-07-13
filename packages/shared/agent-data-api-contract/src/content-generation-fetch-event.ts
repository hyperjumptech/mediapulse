import { z } from "zod";

export const CONTENT_GENERATION_FETCH_EVENTS_MAX = 100;

export const fetchEventStatusSchema = z.enum([
  "succeeded",
  "gate_dropped",
  "fetch_failed",
]);

export const contentGenerationFetchEventItemSchema = z.object({
  dataSourceId: z.string().uuid(),
  tickerId: z.string().trim().min(1),
  reason: z.string(),
  provider: z.string().min(1).nullable().optional(),
  status: fetchEventStatusSchema,
});

export const postContentGenerationFetchEventsBodySchema = z
  .array(contentGenerationFetchEventItemSchema)
  .min(1)
  .max(CONTENT_GENERATION_FETCH_EVENTS_MAX);

export const postContentGenerationFetchEventsResponseSchema = z.object({
  recordedCount: z.number().int().nonnegative(),
});

export type FetchEventStatus = z.infer<typeof fetchEventStatusSchema>;
export type ContentGenerationFetchEventItem = z.infer<
  typeof contentGenerationFetchEventItemSchema
>;
export type PostContentGenerationFetchEventsBody = z.infer<
  typeof postContentGenerationFetchEventsBodySchema
>;
export type PostContentGenerationFetchEventsResponse = z.infer<
  typeof postContentGenerationFetchEventsResponseSchema
>;
