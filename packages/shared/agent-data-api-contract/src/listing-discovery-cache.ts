import { z } from "zod";

const discoveredItemSchema = z.object({
  url: z.string(),
  title: z.string().optional(),
  summary: z.string().optional(),
  publishedAt: z.string().optional(),
});

/**
 * Body for POST `/listing-discovery-cache/lookup`: listing URLs to check for cached items.
 */
export const postListingDiscoveryCacheLookupBodySchema = z.object({
  listingUrls: z.array(z.string().url()),
});

const listingDiscoveryCacheEntrySchema = z.object({
  listingUrl: z.string().url(),
  items: z.array(discoveredItemSchema),
});

/**
 * Response: cached entries for the requested listing URLs (only non-expired rows).
 */
export const postListingDiscoveryCacheLookupResponseSchema = z.object({
  entries: z.array(listingDiscoveryCacheEntrySchema),
});

const listingDiscoveryCacheRecordInputSchema = z.object({
  listingUrl: z.string().url(),
  strategy: z.string(),
  items: z.array(discoveredItemSchema),
  ttlSeconds: z.number().int().positive(),
});

/**
 * Body for POST `/listing-discovery-cache/record`: fresh discovery results to upsert.
 */
export const postListingDiscoveryCacheRecordBodySchema = z.array(
  listingDiscoveryCacheRecordInputSchema,
);

/**
 * Response: number of rows upserted.
 */
export const postListingDiscoveryCacheRecordResponseSchema = z.object({
  recorded: z.number().int().nonnegative(),
});

export type PostListingDiscoveryCacheLookupBody = z.infer<
  typeof postListingDiscoveryCacheLookupBodySchema
>;
export type PostListingDiscoveryCacheLookupResponse = z.infer<
  typeof postListingDiscoveryCacheLookupResponseSchema
>;
export type PostListingDiscoveryCacheRecordBody = z.infer<
  typeof postListingDiscoveryCacheRecordBodySchema
>;
export type PostListingDiscoveryCacheRecordResponse = z.infer<
  typeof postListingDiscoveryCacheRecordResponseSchema
>;
export type ListingDiscoveryCacheRecordInput = z.infer<
  typeof listingDiscoveryCacheRecordInputSchema
>;
export type ListingDiscoveryCacheEntry = z.infer<
  typeof listingDiscoveryCacheEntrySchema
>;
