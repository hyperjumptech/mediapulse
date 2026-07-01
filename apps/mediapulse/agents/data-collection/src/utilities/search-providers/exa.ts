import { z } from "zod";

import { RECENCY_DAYS, RESULTS_PER_QUERY } from "./constants";

import type {
  SearchHit,
  SearchProvider,
  SearchProviderContext,
  SearchProviderResult,
} from "./types";

const EXA_SEARCH_URL = "https://api.exa.ai/search";

const exaResultSchema = z.object({
  title: z.string().optional(),
  url: z.string().optional(),
  text: z.string().optional(),
  publishedDate: z.string().optional(),
});

const exaResponseSchema = z.object({
  results: z.array(exaResultSchema).optional(),
});

const parseExaResponse = (raw: unknown): SearchHit[] => {
  const parsed = exaResponseSchema.safeParse(raw);
  if (!parsed.success) {
    throw parsed.error;
  }

  const items = parsed.data.results ?? [];

  return items
    .filter((item): item is { url: string } & typeof item => Boolean(item.url))
    .map((item) => ({
      url: item.url,
      title: item.title ?? "",
      snippet: (item.text ?? "").replace(/\s+/g, " ").trim().slice(0, 300),
      ...(item.publishedDate ? { publishedAt: item.publishedDate } : {}),
    }));
};

/** Returns the ISO start date for the recency window. */
const recencyStartDate = (): string =>
  new Date(Date.now() - RECENCY_DAYS * 24 * 60 * 60 * 1000).toISOString();

const searchExa = async (
  apiKey: string,
  queryText: string,
  ctx: SearchProviderContext,
): Promise<SearchProviderResult> => {
  const response = await ctx.gotClient.post(EXA_SEARCH_URL, {
    json: {
      query: queryText,
      numResults: RESULTS_PER_QUERY,
      type: "auto",
      category: "news",
      contents: { text: { maxCharacters: 500 } },
      startPublishedDate: recencyStartDate(),
    },
    headers: {
      "x-api-key": apiKey,
      "Content-Type": "application/json",
    },
    timeout: { request: ctx.timeoutMs },
  });

  return { hits: parseExaResponse(JSON.parse(response.body)) };
};

/**
 * Creates an Exa news search provider. Locale is ignored (Exa is English-centric).
 *
 * @param apiKey - Exa API key.
 */
export const createExaSearchProvider = (apiKey: string): SearchProvider => ({
  type: "exa",
  search: (queryText, ctx) => searchExa(apiKey, queryText, ctx),
});
