import { z } from "zod";

import { collectionUrlStatusSchema } from "./collection-url-outcome.js";

export const pageCollectionUrlOutcomeInputSchema = z.object({
  id: z.string().uuid(),
  scheduleExecutionId: z.string().uuid().optional(),
  runId: z.string().uuid(),
  tickerId: z.string().trim().min(1).optional(),
  status: collectionUrlStatusSchema,
  url: z.string().url(),
  reason: z.string().optional(),
  reasonDetail: z.string().optional(),
  source: z.string().optional(),
  curatedSourceId: z.string().uuid().optional(),
  createdAt: z.string().datetime(),
});

export const postPageCollectionUrlOutcomeBodySchema = z.array(
  pageCollectionUrlOutcomeInputSchema,
);

export const postPageCollectionUrlOutcomeResponseSchema = z.object({
  message: z.string(),
});

export type PageCollectionUrlOutcomeInput = z.infer<
  typeof pageCollectionUrlOutcomeInputSchema
>;
export type PostPageCollectionUrlOutcomeBody = z.infer<
  typeof postPageCollectionUrlOutcomeBodySchema
>;
export type PostPageCollectionUrlOutcomeResponse = z.infer<
  typeof postPageCollectionUrlOutcomeResponseSchema
>;
