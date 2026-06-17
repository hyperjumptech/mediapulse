import { z } from "zod";

/** Categories eligible for negative caching. */
export const DEAD_URL_CACHEABLE_CATEGORIES = [
  "provider_http_error",
  "provider_data_invalid",
  "content_too_short",
] as const;

/** Max URLs per dead-url lookup request (data-collection agent batching). */
export const DATA_COLLECTION_DEAD_URLS_LOOKUP_MAX = 500;

export type DeadUrlCacheableCategory =
  (typeof DEAD_URL_CACHEABLE_CATEGORIES)[number];

export const deadUrlErrorCategorySchema = z.enum([
  ...DEAD_URL_CACHEABLE_CATEGORIES,
]);

/**
 * Body for POST `/data-collection/dead-urls/lookup`: which ticker and candidate URLs to check.
 */
export const postDataCollectionDeadUrlsLookupBodySchema = z.object({
  /** When omitted, lookup is global (page-collection v2). */
  tickerId: z.string().trim().min(1).optional(),
  urls: z.array(z.string().url()).max(DATA_COLLECTION_DEAD_URLS_LOOKUP_MAX),
});

/**
 * Response: subset of requested URLs that are currently cached as dead for the ticker.
 */
export const postDataCollectionDeadUrlsLookupResponseSchema = z.object({
  deadUrls: z.array(z.string()),
});

const deadUrlRecordInputSchema = z.object({
  /** Optional; global negative cache when omitted. */
  tickerId: z.string().trim().min(1).optional(),
  url: z.string().url(),
  errorCategory: deadUrlErrorCategorySchema,
  /** HTTP status when `errorCategory` is `provider_http_error` (404, 403, 410, 451). */
  httpStatus: z.number().int().optional(),
});

/**
 * Body for POST `/data-collection/dead-urls/record`: batch of dead URLs to persist or refresh.
 */
export const postDataCollectionDeadUrlsRecordBodySchema = z.array(
  deadUrlRecordInputSchema,
);

export const postDataCollectionDeadUrlsRecordResponseSchema = z.object({
  message: z.string(),
  recordedCount: z.number().int().nonnegative(),
});

export type PostDataCollectionDeadUrlsLookupBody = z.infer<
  typeof postDataCollectionDeadUrlsLookupBodySchema
>;
export type PostDataCollectionDeadUrlsLookupResponse = z.infer<
  typeof postDataCollectionDeadUrlsLookupResponseSchema
>;
export type PostDataCollectionDeadUrlsRecordBody = z.infer<
  typeof postDataCollectionDeadUrlsRecordBodySchema
>;
export type PostDataCollectionDeadUrlsRecordResponse = z.infer<
  typeof postDataCollectionDeadUrlsRecordResponseSchema
>;
export type DeadUrlRecordInput = z.infer<typeof deadUrlRecordInputSchema>;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** TTL in days per HTTP status for `provider_http_error`. */
const HTTP_STATUS_TTL_DAYS: Record<number, number> = {
  404: 30,
  403: 7,
  410: 30,
  451: 30,
};

const CATEGORY_TTL_DAYS: Record<
  Exclude<DeadUrlCacheableCategory, "provider_http_error">,
  number
> = {
  provider_data_invalid: 3,
  content_too_short: 7,
};

const CACHEABLE_HTTP_STATUSES = new Set([404, 403, 410, 451]);

/**
 * Returns whether a failure is eligible for the dead-url negative cache.
 *
 * @param errorCategory - Failure or quality-gate category string.
 * @param httpStatus - Optional HTTP status for provider HTTP errors.
 */
export const isDeadUrlCacheable = (
  errorCategory: string,
  httpStatus?: number,
): errorCategory is DeadUrlCacheableCategory => {
  if (errorCategory === "provider_data_invalid") {
    return true;
  }
  if (errorCategory === "content_too_short") {
    return true;
  }
  if (errorCategory === "provider_http_error") {
    return httpStatus !== undefined && CACHEABLE_HTTP_STATUSES.has(httpStatus);
  }
  return false;
};

/**
 * Computes the expiry timestamp for a cacheable dead URL.
 *
 * @param errorCategory - Cacheable failure category.
 * @param httpStatus - HTTP status when category is `provider_http_error`.
 * @param now - Reference time (defaults to current time).
 */
export const computeDeadUrlExpiresAt = (
  errorCategory: DeadUrlCacheableCategory,
  httpStatus: number | undefined,
  now: Date = new Date(),
): Date => {
  if (errorCategory === "provider_http_error") {
    const status = httpStatus ?? 404;
    const ttlDays = HTTP_STATUS_TTL_DAYS[status] ?? 30;
    return new Date(now.getTime() + ttlDays * MS_PER_DAY);
  }

  const ttlDays = CATEGORY_TTL_DAYS[errorCategory];
  return new Date(now.getTime() + ttlDays * MS_PER_DAY);
};
