import { z } from "zod";

export const collectionAgentSchema = z.enum([
  "data-collection",
  "page-collection",
]);

export const collectionUrlStatusSchema = z.enum([
  "collected",
  "dropped",
  "failed",
]);

export const collectionUrlOutcomeInputSchema = z.object({
  id: z.string().uuid(),
  scheduleExecutionId: z.string().uuid().optional(),
  runId: z.string().uuid(),
  tickerId: z.string().trim().min(1).optional(),
  agent: collectionAgentSchema,
  status: collectionUrlStatusSchema,
  url: z.string().url(),
  reason: z.string().optional(),
  reasonDetail: z.string().optional(),
  source: z.string().optional(),
  searchQueryId: z.string().uuid().optional(),
  curatedSourceId: z.string().uuid().optional(),
  createdAt: z.string().datetime(),
});

export const postCollectionUrlOutcomeBodySchema = z.array(
  collectionUrlOutcomeInputSchema,
);

export const postCollectionUrlOutcomeResponseSchema = z.object({
  message: z.string(),
});

export type CollectionAgent = z.infer<typeof collectionAgentSchema>;
export type CollectionUrlStatus = z.infer<typeof collectionUrlStatusSchema>;
export type CollectionUrlOutcomeInput = z.infer<
  typeof collectionUrlOutcomeInputSchema
>;
export type PostCollectionUrlOutcomeBody = z.infer<
  typeof postCollectionUrlOutcomeBodySchema
>;
export type PostCollectionUrlOutcomeResponse = z.infer<
  typeof postCollectionUrlOutcomeResponseSchema
>;
