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
  publishedAt: z.string().datetime().optional(),
  metadata: z.object({ provider: z.string().optional() }).optional(),
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
 * Response: subset of requested URLs that already have a `data_source` row for the ticker (exact URL match),
 * plus host counts for host-fatigue ranking.
 */
export const postDataCollectionExistingUrlsResponseSchema = z.object({
  existingUrls: z.array(z.string()),
  hostCounts: z.record(z.string(), z.number().int().nonnegative()),
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

/** Max recent sources returned for semantic dedupe fingerprinting. */
export const DATA_COLLECTION_MAX_FINGERPRINTS = 200;

/** Head snippet length (chars) for corpus fingerprint text. */
export const DATA_COLLECTION_FINGERPRINT_HEAD_CHARS = 600;

/**
 * Query for GET `/data-collection/recent-source-fingerprints`: recent corpus titles and head snippets.
 */
export const getDataCollectionRecentSourceFingerprintsQuerySchema = z.object({
  tickerId: z.string().trim().min(1),
  windowDays: z.coerce.number().int().positive().default(7),
});

export const sourceFingerprintSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  headSnippet: z.string(),
});

/**
 * Response: recent `data_source` rows as embeddable fingerprints (no vectors stored server-side).
 */
export const getDataCollectionRecentSourceFingerprintsResponseSchema = z.object(
  {
    fingerprints: z.array(sourceFingerprintSchema),
  },
);

export type GetDataCollectionRecentSourceFingerprintsQuery = z.infer<
  typeof getDataCollectionRecentSourceFingerprintsQuerySchema
>;
export type GetDataCollectionRecentSourceFingerprintsResponse = z.infer<
  typeof getDataCollectionRecentSourceFingerprintsResponseSchema
>;
export type SourceFingerprint = z.infer<typeof sourceFingerprintSchema>;

/**
 * Body for POST `/data-collection/curated-listing-query`: ensures a per-ticker synthetic query.
 */
export const postCuratedListingQueryBodySchema = z.object({
  tickerId: z.string().uuid(),
});

/**
 * Response: the stable id of the curated SearchQuery row for the ticker.
 */
export const postCuratedListingQueryResponseSchema = z.object({
  searchQueryId: z.string().uuid(),
});

export type PostCuratedListingQueryBody = z.infer<
  typeof postCuratedListingQueryBodySchema
>;
export type PostCuratedListingQueryResponse = z.infer<
  typeof postCuratedListingQueryResponseSchema
>;
