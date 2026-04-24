import { z } from "zod";

export const dataCollectionQuerySchema = z.object({
  tickerId: z.string().trim().min(1),
  start: z.string().datetime().optional(),
  end: z.string().datetime().optional(),
});

const dataCollectionInputSchema = z.object({
  url: z.string().url(),
  title: z.string(),
  description: z.string().optional(),
  content: z.string(),
  tickerId: z.string().trim().min(1),
  searchQueryId: z.string().uuid(),
});

export const dataCollectionBodySchema = z.array(dataCollectionInputSchema);

export const getDataCollectionResponseSchema = z.object({
  data: z.array(
    z.object({
      id: z.string().uuid(),
      text: z.string(),
      tickerId: z.string().trim().min(1),
    }),
  ),
});

export const postDataCollectionResponseSchema = z.object({
  message: z.string(),
});

/** Max URLs per existing-url lookup request (data-collection agent batching). */
export const DATA_COLLECTION_EXISTING_URLS_MAX = 500;

/**
 * Body for POST `/data-collection-existing-urls`: which ticker and which candidate URLs to check.
 */
export const postDataCollectionExistingUrlsBodySchema = z.object({
  tickerId: z.string().trim().min(1),
  urls: z.array(z.string().url()).max(DATA_COLLECTION_EXISTING_URLS_MAX),
});

/**
 * Response: subset of requested URLs that already have a `data_source` row for the ticker (exact URL match).
 */
export const postDataCollectionExistingUrlsResponseSchema = z.object({
  existingUrls: z.array(z.string()),
});

export type DataCollectionBody = z.infer<typeof dataCollectionBodySchema>;
export type DataCollectionQuery = z.infer<typeof dataCollectionQuerySchema>;
export type GetDataCollectionResponse = z.infer<
  typeof getDataCollectionResponseSchema
>;
export type PostDataCollectionResponse = z.infer<
  typeof postDataCollectionResponseSchema
>;
export type PostDataCollectionExistingUrlsBody = z.infer<
  typeof postDataCollectionExistingUrlsBodySchema
>;
export type PostDataCollectionExistingUrlsResponse = z.infer<
  typeof postDataCollectionExistingUrlsResponseSchema
>;
