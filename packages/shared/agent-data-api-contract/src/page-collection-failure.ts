import { z } from "zod";

import { dataCollectionFailureErrorCategorySchema } from "./data-collection-failure.js";

export const pageCollectionFailureInputSchema = z.object({
  id: z.string().uuid(),
  runId: z.string().uuid(),
  tickerId: z.string().trim().min(1).optional(),
  stage: z.enum(["web-search", "web-fetch"]),
  provider: z.enum([
    "serper",
    "jina",
    "firecrawl",
    "firecrawl_selfhosted",
    "diffbot",
    "tavily",
    "exa",
  ]),
  url: z.string().url().optional(),
  errorCategory: dataCollectionFailureErrorCategorySchema,
  retryable: z.boolean(),
  httpStatus: z.number().int().optional(),
  message: z.string(),
  createdAt: z.string().datetime(),
});

export const postPageCollectionFailureBodySchema = z.array(
  pageCollectionFailureInputSchema,
);

export const postPageCollectionFailureResponseSchema = z.object({
  message: z.string(),
});

export const getPageCollectionFailureResponseSchema = z.object({
  data: z.array(pageCollectionFailureInputSchema),
});

export const pageCollectionFailureQuerySchema = z.object({
  runId: z.string().uuid().optional(),
  tickerId: z.string().trim().min(1).optional(),
});

export type PageCollectionFailureBody = z.infer<
  typeof postPageCollectionFailureBodySchema
>;
export type PostPageCollectionFailureResponse = z.infer<
  typeof postPageCollectionFailureResponseSchema
>;
export type GetPageCollectionFailureResponse = z.infer<
  typeof getPageCollectionFailureResponseSchema
>;
export type PageCollectionFailureQuery = z.infer<
  typeof pageCollectionFailureQuerySchema
>;
export type PageCollectionFailure = z.infer<
  typeof pageCollectionFailureInputSchema
>;
