import { z } from "zod";

export const getTickerQuerySchema = z.object({
  tickerId: z.string().trim().min(1),
});

export const getTickerResponseSchema = z.object({
  id: z.string().uuid(),
  symbol: z.string(),
  name: z.string(),
  /** Known alternate names and symbols for relevance matching (excludes duplicates of symbol/name). */
  aliases: z.array(z.string()),
});

export type GetTickerQuery = z.infer<typeof getTickerQuerySchema>;
export type GetTickerResponse = z.infer<typeof getTickerResponseSchema>;
