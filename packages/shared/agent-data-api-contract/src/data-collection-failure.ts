import { z } from "zod";

export const dataCollectionFailureErrorCategorySchema = z.enum([
  "network_error",
  "timeout_error",
  "provider_http_error",
  "provider_schema_error",
  "provider_data_invalid",
  "internal_processing_error",
]);

export const dataCollectionFailureInputSchema = z.object({
  id: z.string().uuid(),
  runId: z.string().uuid(),
  tickerId: z.string().uuid(),
  stage: z.enum(["web-search", "web-fetch"]),
  provider: z.enum(["serper", "jina"]),
  searchQueryId: z.string().uuid().optional(),
  url: z.string().url().optional(),
  errorCategory: dataCollectionFailureErrorCategorySchema,
  retryable: z.boolean(),
  httpStatus: z.number().int().optional(),
  message: z.string(),
  createdAt: z.string().datetime(),
});

export const postDataCollectionFailureBodySchema = z.array(
  dataCollectionFailureInputSchema,
);

export const postDataCollectionFailureResponseSchema = z.object({
  message: z.string(),
});

export const getDataCollectionFailureResponseSchema = z.object({
  data: z.array(dataCollectionFailureInputSchema),
});

export const dataCollectionFailureQuerySchema = z.object({
  runId: z.string().uuid().optional(),
  tickerId: z.string().uuid().optional(),
});

export type DataCollectionFailureBody = z.infer<
  typeof postDataCollectionFailureBodySchema
>;
export type PostDataCollectionFailureResponse = z.infer<
  typeof postDataCollectionFailureResponseSchema
>;
export type GetDataCollectionFailureResponse = z.infer<
  typeof getDataCollectionFailureResponseSchema
>;
export type DataCollectionFailureQuery = z.infer<
  typeof dataCollectionFailureQuerySchema
>;
export type DataCollectionFailure = z.infer<
  typeof dataCollectionFailureInputSchema
>;
