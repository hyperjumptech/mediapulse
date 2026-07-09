import { z } from "zod";

import { collectionRunSnapshotSchema } from "./collection-run-snapshot.js";

export const dataCollectionRunStatusSchema = z.enum([
  "success",
  "partial_success",
  "failed",
]);

export const dataCollectionRunInputSchema = z.object({
  id: z.string().uuid(),
  tickerId: z.string().trim().min(1).optional(),
  scheduleExecutionId: z.string().uuid().optional(),
  startedAt: z.string().datetime(),
  completedAt: z.string().datetime(),
  status: dataCollectionRunStatusSchema,
  snapshot: collectionRunSnapshotSchema,
});

export const postDataCollectionRunBodySchema = dataCollectionRunInputSchema;

export const postDataCollectionRunResponseSchema = z.object({
  message: z.string(),
});

export const getDataCollectionRunResponseSchema = z.object({
  data: z.array(dataCollectionRunInputSchema),
});

export const dataCollectionRunQuerySchema = z.object({
  tickerId: z.string().trim().min(1).optional(),
  start: z.string().datetime().optional(),
  end: z.string().datetime().optional(),
});

export type DataCollectionRunBody = z.infer<
  typeof postDataCollectionRunBodySchema
>;
export type PostDataCollectionRunResponse = z.infer<
  typeof postDataCollectionRunResponseSchema
>;
export type GetDataCollectionRunResponse = z.infer<
  typeof getDataCollectionRunResponseSchema
>;
export type DataCollectionRunQuery = z.infer<
  typeof dataCollectionRunQuerySchema
>;
export type DataCollectionRun = z.infer<typeof dataCollectionRunInputSchema>;
