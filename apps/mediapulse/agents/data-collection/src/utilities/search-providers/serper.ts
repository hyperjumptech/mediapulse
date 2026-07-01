import { z } from "zod";

import { RESULTS_PER_QUERY } from "./constants";

import type {
  SearchHit,
  SearchProvider,
  SearchProviderContext,
  SearchProviderResult,
} from "./types";

const SERPER_NEWS_URL = "https://google.serper.dev/news";

/** Serper `tbs` recency preset for the news search window. */
const SERPER_RECENCY_TBS = "qdr:w";

const serperNewsItemSchema = z.object({
  title: z.string().optional(),
  link: z.string().optional(),
  snippet: z.string().optional(),
  date: z.string().optional(),
});

const serperResponseSchema = z.object({
  news: z.array(serperNewsItemSchema).optional(),
  /** Serper reports the credits consumed by the request on every response. */
  credits: z.number().nonnegative().optional(),
});

const parseSerperResponse = (raw: unknown): SearchProviderResult => {
  const parsed = serperResponseSchema.safeParse(raw);
  if (!parsed.success) {
    throw parsed.error;
  }

  const items = parsed.data.news ?? [];

  const hits: SearchHit[] = items
    .filter((item): item is { link: string } & typeof item =>
      Boolean(item.link),
    )
    .map((item) => ({
      url: item.link,
      title: item.title ?? "",
      snippet: item.snippet ?? "",
      ...(item.date ? { publishedAt: item.date } : {}),
    }));

  return {
    hits,
    ...(parsed.data.credits !== undefined
      ? { credits: parsed.data.credits }
      : {}),
  };
};

const searchSerper = async (
  apiKey: string,
  queryText: string,
  ctx: SearchProviderContext,
): Promise<SearchProviderResult> => {
  const response = await ctx.gotClient.post(SERPER_NEWS_URL, {
    json: {
      q: queryText,
      gl: ctx.locale.gl,
      hl: ctx.locale.hl,
      tbs: SERPER_RECENCY_TBS,
      num: RESULTS_PER_QUERY,
      page: ctx.page + 1,
    },
    headers: {
      "X-API-KEY": apiKey,
      "Content-Type": "application/json",
    },
    timeout: { request: ctx.timeoutMs },
  });

  return parseSerperResponse(JSON.parse(response.body));
};

/**
 * Creates a Serper news search provider.
 *
 * @param apiKey - Serper API key.
 */
export const createSerperSearchProvider = (apiKey: string): SearchProvider => ({
  type: "serper",
  search: (queryText, ctx) => searchSerper(apiKey, queryText, ctx),
});
