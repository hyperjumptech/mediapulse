import { z } from "zod";

const discoverySourceHealthRecordInputSchema = z.object({
  listingUrl: z.string().url(),
  runDate: z.string().datetime(),
  discovered: z.boolean(),
  itemCount: z.number().int().nonnegative(),
  winningStrategy: z.string().nullable().optional(),
  failureCount: z.number().int().nonnegative(),
  lastError: z.string().nullable().optional(),
});

/**
 * Body for POST `/discovery-source-health/record`: per-source daily health rows to upsert.
 */
export const postDiscoverySourceHealthRecordBodySchema = z.array(
  discoverySourceHealthRecordInputSchema,
);

/**
 * Response: number of rows upserted.
 */
export const postDiscoverySourceHealthRecordResponseSchema = z.object({
  recorded: z.number().int().nonnegative(),
});

/**
 * Body for POST `/discovery-source-health/get`: listing URLs and lookback window.
 */
export const postDiscoverySourceHealthGetBodySchema = z.object({
  listingUrls: z.array(z.string().url()),
  windowDays: z.number().int().positive().default(30),
});

const discoverySourceHealthRowSchema = z.object({
  listingUrl: z.string().url(),
  runDate: z.string().datetime(),
  discovered: z.boolean(),
  itemCount: z.number().int().nonnegative(),
  winningStrategy: z.string().nullable(),
  failureCount: z.number().int().nonnegative(),
  lastError: z.string().nullable(),
  computedAt: z.string().datetime(),
});

const discoverySourceHealthEntrySchema = z.object({
  listingUrl: z.string().url(),
  rows: z.array(discoverySourceHealthRowSchema),
  consecutiveFailedRuns: z.number().int().nonnegative(),
  lastSuccessfulAt: z.string().datetime().nullable(),
  failureRate: z.number().min(0).max(1),
});

/**
 * Response: per-source health entries with derived failure signals.
 */
export const postDiscoverySourceHealthGetResponseSchema = z.array(
  discoverySourceHealthEntrySchema,
);

export type PostDiscoverySourceHealthRecordBody = z.infer<
  typeof postDiscoverySourceHealthRecordBodySchema
>;
export type PostDiscoverySourceHealthRecordResponse = z.infer<
  typeof postDiscoverySourceHealthRecordResponseSchema
>;
export type PostDiscoverySourceHealthGetBody = z.infer<
  typeof postDiscoverySourceHealthGetBodySchema
>;
export type PostDiscoverySourceHealthGetResponse = z.infer<
  typeof postDiscoverySourceHealthGetResponseSchema
>;
export type DiscoverySourceHealthRecordInput = z.infer<
  typeof discoverySourceHealthRecordInputSchema
>;
export type DiscoverySourceHealthEntry = z.infer<
  typeof discoverySourceHealthEntrySchema
>;
