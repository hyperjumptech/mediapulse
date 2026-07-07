import { z } from "zod";

/** A discovered competitor or regulator with alias and search-keyword hints. */
const tickerDiscoveryPartySchema = z.object({
  name: z.string(),
  aliases: z.array(z.string()),
  searchKeywords: z.array(z.string()),
});

/**
 * Body for POST `/ticker-discovery/lookup`: the ticker whose cached discovery to fetch.
 */
export const postTickerDiscoveryLookupBodySchema = z.object({
  tickerId: z.string().uuid(),
});

/** A cached ticker-discovery entry (competitors + regulators + audit model). */
const tickerDiscoveryEntrySchema = z.object({
  tickerId: z.string().uuid(),
  competitors: z.array(tickerDiscoveryPartySchema),
  regulators: z.array(tickerDiscoveryPartySchema),
  model: z.string().nullable(),
  /** Agent contract version active when this entry was written; `null` for legacy entries. */
  contractVersion: z.string().nullable(),
  expiresAt: z.string().datetime(),
});

/**
 * Response: the cached entry, or `null` when missing or expired.
 */
export const postTickerDiscoveryLookupResponseSchema = z.object({
  entry: tickerDiscoveryEntrySchema.nullable(),
});

/**
 * Body for POST `/ticker-discovery/record`: fresh discovery results to upsert with a TTL.
 */
export const postTickerDiscoveryRecordBodySchema = z.object({
  tickerId: z.string().uuid(),
  competitors: z.array(tickerDiscoveryPartySchema),
  regulators: z.array(tickerDiscoveryPartySchema),
  model: z.string().optional(),
  contractVersion: z.string().optional(),
  ttlSeconds: z.number().int().positive(),
});

/**
 * Response: the upserted ticker id and its refreshed expiry.
 */
export const postTickerDiscoveryRecordResponseSchema = z.object({
  tickerId: z.string().uuid(),
  expiresAt: z.string().datetime(),
});

export type PostTickerDiscoveryLookupBody = z.infer<
  typeof postTickerDiscoveryLookupBodySchema
>;
export type PostTickerDiscoveryLookupResponse = z.infer<
  typeof postTickerDiscoveryLookupResponseSchema
>;
export type PostTickerDiscoveryRecordBody = z.infer<
  typeof postTickerDiscoveryRecordBodySchema
>;
export type PostTickerDiscoveryRecordResponse = z.infer<
  typeof postTickerDiscoveryRecordResponseSchema
>;
export type TickerDiscoveryParty = z.infer<typeof tickerDiscoveryPartySchema>;
export type TickerDiscoveryEntry = z.infer<typeof tickerDiscoveryEntrySchema>;
