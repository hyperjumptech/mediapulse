import { z } from "zod";

import { collectionRunSnapshotSchema } from "./collection-run-snapshot.js";

export const pageCollectionRunStatusSchema = z.enum([
  "success",
  "partial_success",
  "failed",
]);

export const pageCollectionRunInputSchema = z.object({
  id: z.string().uuid(),
  tickerId: z.string().trim().min(1).optional(),
  scheduleExecutionId: z.string().uuid().optional(),
  startedAt: z.string().datetime(),
  completedAt: z.string().datetime(),
  status: pageCollectionRunStatusSchema,
  snapshot: collectionRunSnapshotSchema,
});

export const postPageCollectionRunBodySchema = pageCollectionRunInputSchema;

export const postPageCollectionRunResponseSchema = z.object({
  message: z.string(),
});

export const getPageCollectionRunResponseSchema = z.object({
  data: z.array(pageCollectionRunInputSchema),
});

export const pageCollectionRunQuerySchema = z.object({
  tickerId: z.string().trim().min(1).optional(),
  start: z.string().datetime().optional(),
  end: z.string().datetime().optional(),
});

export type PageCollectionRunBody = z.infer<
  typeof postPageCollectionRunBodySchema
>;
export type PostPageCollectionRunResponse = z.infer<
  typeof postPageCollectionRunResponseSchema
>;
export type GetPageCollectionRunResponse = z.infer<
  typeof getPageCollectionRunResponseSchema
>;
export type PageCollectionRunQuery = z.infer<
  typeof pageCollectionRunQuerySchema
>;
export type PageCollectionRun = z.infer<typeof pageCollectionRunInputSchema>;
