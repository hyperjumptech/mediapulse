import { z } from "zod";

export const getTickerQuerySchema = z.object({
  tickerId: z.string().trim().min(1),
});

export const tickerPeerSchema = z.object({
  symbol: z.string(),
  name: z.string(),
});

export const getTickerResponseSchema = z.object({
  id: z.guid(),
  symbol: z.string(),
  name: z.string(),
  /** Known alternate names and symbols for relevance matching (excludes duplicates of symbol/name). */
  aliases: z.array(z.string()),
  sector: z.string().nullable(),
  industry: z.string().nullable(),
  subSector: z.string().nullable(),
  subIndustry: z.string().nullable(),
  businessActivity: z.string().nullable(),
  peers: z.array(tickerPeerSchema),
});

export type TickerPeer = z.infer<typeof tickerPeerSchema>;

export type GetTickerQuery = z.infer<typeof getTickerQuerySchema>;
export type GetTickerResponse = z.infer<typeof getTickerResponseSchema>;
