import { z } from "zod";

export const getTickerQuerySchema = z.object({
  tickerId: z.string().trim().min(1),
});

/** A sector/industry peer surfaced for competitive-landscape relevance. */
export const tickerPeerSchema = z.object({
  symbol: z.string(),
  name: z.string(),
});

export const getTickerResponseSchema = z.object({
  id: z.string().uuid(),
  symbol: z.string(),
  name: z.string(),
  /** Known alternate names and symbols for relevance matching (excludes duplicates of symbol/name). */
  aliases: z.array(z.string()),
  /** Sector label from ticker metadata (IDX `Sektor` or English `sector`), when present. */
  sector: z.string().nullable(),
  /** Industry label from ticker metadata (IDX `Industri` or English `industry`), when present. */
  industry: z.string().nullable(),
  /** Sub-sector label from ticker metadata (IDX `SubSektor` or English `sub_sector`), when present. */
  subSector: z.string().nullable(),
  /** Sub-industry label from ticker metadata (IDX `SubIndustri` or English `sub_industry`), when present. */
  subIndustry: z.string().nullable(),
  /** Main business activity from ticker metadata (IDX `KegiatanUsahaUtama` or English `business_activity`), when present. */
  businessActivity: z.string().nullable(),
  /** Sector/industry peers (ordered by market cap, capped) for competitive-landscape relevance. */
  peers: z.array(tickerPeerSchema),
});

export type TickerPeer = z.infer<typeof tickerPeerSchema>;

export type GetTickerQuery = z.infer<typeof getTickerQuerySchema>;
export type GetTickerResponse = z.infer<typeof getTickerResponseSchema>;
