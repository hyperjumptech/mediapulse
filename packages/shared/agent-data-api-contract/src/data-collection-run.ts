import { z } from "zod";

export const dataCollectionRunStatusSchema = z.enum([
  "success",
  "partial_success",
  "failed",
]);

export const dataCollectionRunInputSchema = z.object({
  id: z.string().uuid(),
  tickerId: z.string().uuid(),
  startedAt: z.string().datetime(),
  completedAt: z.string().datetime(),
  status: dataCollectionRunStatusSchema,
  counters: z.object({
    queriesTotal: z.number().int().nonnegative(),
    urlsTotal: z.number().int().nonnegative(),
    searchSuccess: z.number().int().nonnegative(),
    searchFailed: z.number().int().nonnegative(),
    fetchSuccess: z.number().int().nonnegative(),
    fetchFailed: z.number().int().nonnegative(),
    retryCount: z.number().int().nonnegative(),
  }),
});

export const postDataCollectionRunBodySchema = dataCollectionRunInputSchema;

export const postDataCollectionRunResponseSchema = z.object({
  message: z.string(),
});

export const getDataCollectionRunResponseSchema = z.object({
  data: z.array(dataCollectionRunInputSchema),
});

export const dataCollectionRunQuerySchema = z.object({
  tickerId: z.string().uuid().optional(),
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
