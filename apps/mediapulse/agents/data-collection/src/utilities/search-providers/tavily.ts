import { z } from "zod";

import { RESULTS_PER_QUERY } from "./constants";

import type { SearchHit, SearchProvider, SearchProviderContext } from "./types";

const TAVILY_SEARCH_URL = "https://api.tavily.com/search";

/** Tavily `time_range` recency preset for the news search window. */
const TAVILY_RECENCY = "week";

const tavilyResultSchema = z.object({
  title: z.string().optional(),
  url: z.string().optional(),
  content: z.string().optional(),
  published_date: z.string().optional(),
});

const tavilyResponseSchema = z.object({
  results: z.array(tavilyResultSchema).optional(),
});

const parseTavilyResponse = (raw: unknown): SearchHit[] => {
  const parsed = tavilyResponseSchema.safeParse(raw);
  if (!parsed.success) {
    throw parsed.error;
  }

  const items = parsed.data.results ?? [];

  return items
    .filter((item): item is { url: string } & typeof item => Boolean(item.url))
    .map((item) => ({
      url: item.url,
      title: item.title ?? "",
      snippet: item.content ?? "",
      ...(item.published_date ? { publishedAt: item.published_date } : {}),
    }));
};

const searchTavily = async (
  apiKey: string,
  queryText: string,
  ctx: SearchProviderContext,
): Promise<SearchHit[]> => {
  const response = await ctx.gotClient.post(TAVILY_SEARCH_URL, {
    json: {
      query: queryText,
      topic: "news",
      max_results: RESULTS_PER_QUERY,
      time_range: TAVILY_RECENCY,
    },
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    timeout: { request: ctx.timeoutMs },
  });

  return parseTavilyResponse(JSON.parse(response.body));
};

/**
 * Creates a Tavily news search provider.
 *
 * @param apiKey - Tavily API key.
 */
export const createTavilySearchProvider = (apiKey: string): SearchProvider => ({
  type: "tavily",
  search: (queryText, ctx) => searchTavily(apiKey, queryText, ctx),
});
