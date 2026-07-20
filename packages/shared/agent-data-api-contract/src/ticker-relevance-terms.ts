import { z } from "zod";

/** Query for listing relevance terms across active tickers (no parameters). */
export const getTickerRelevanceTermsQuerySchema = z.object({});

/** Relevance-matching terms for one active ticker. */
export const tickerRelevanceTermsItemSchema = z.object({
  id: z.string().uuid(),
  symbol: z.string(),
  /** Deduplicated symbol, name, alias, peer, and sector/industry strings for relevance matching. */
  terms: z.array(z.string()),
});

export const getTickerRelevanceTermsResponseSchema = z.object({
  tickers: z.array(tickerRelevanceTermsItemSchema),
});

export type TickerRelevanceTermsItem = z.infer<
  typeof tickerRelevanceTermsItemSchema
>;

export type GetTickerRelevanceTermsQuery = z.infer<
  typeof getTickerRelevanceTermsQuerySchema
>;
export type GetTickerRelevanceTermsResponse = z.infer<
  typeof getTickerRelevanceTermsResponseSchema
>;
