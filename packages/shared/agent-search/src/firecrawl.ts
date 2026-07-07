import { z } from "zod";

import { RESULTS_PER_QUERY } from "./constants";

import type {
  SearchHit,
  SearchProvider,
  SearchProviderContext,
  SearchProviderResult,
} from "./types";

/** Default Firecrawl cloud base URL. Self-hosted instances override this. */
const FIRECRAWL_CLOUD_BASE_URL = "https://api.firecrawl.dev";

/** Firecrawl `tbs` recency preset for the news search window (weekly). */
const FIRECRAWL_RECENCY_TBS = "qdr:w";

/** Transport configuration shared by cloud and self-hosted Firecrawl search. */
interface FirecrawlSearchConfig {
  baseUrl: string;
  /** Bearer API key (Firecrawl cloud). Omitted for self-hosted header auth. */
  apiKey?: string;
  /** Extra headers sent with every request (for example Cloudflare Access). */
  headers?: Record<string, string>;
}

/**
 * Firecrawl v2 search returns results grouped by source. Cloud populates `news`
 * (with `snippet`/`date`); some self-hosted builds return everything under `web`
 * (with `description` and no date), so both arrays are parsed.
 */
const firecrawlSearchItemSchema = z
  .object({
    url: z.string().optional(),
    title: z.string().optional(),
    snippet: z.string().optional(),
    description: z.string().optional(),
    date: z.string().optional(),
  })
  .passthrough();

const firecrawlSearchResponseSchema = z.object({
  success: z.boolean(),
  data: z
    .object({
      news: z.array(firecrawlSearchItemSchema).optional(),
      web: z.array(firecrawlSearchItemSchema).optional(),
    })
    .passthrough()
    .optional(),
  /** Firecrawl reports the credits consumed by the request on every response. */
  creditsUsed: z.number().nonnegative().optional(),
});

const parseFirecrawlResponse = (raw: unknown): SearchProviderResult => {
  const parsed = firecrawlSearchResponseSchema.safeParse(raw);
  if (!parsed.success) {
    throw parsed.error;
  }

  if (!parsed.data.success) {
    throw new Error("Firecrawl search reported success: false");
  }

  const news = parsed.data.data?.news ?? [];
  const web = parsed.data.data?.web ?? [];
  const items = news.length > 0 ? news : web;

  const hits: SearchHit[] = items
    .filter((item): item is { url: string } & typeof item => Boolean(item.url))
    .map((item) => ({
      url: item.url,
      title: item.title ?? "",
      snippet: item.snippet ?? item.description ?? "",
      ...(item.date ? { publishedAt: item.date } : {}),
    }));

  return {
    hits,
    ...(parsed.data.creditsUsed !== undefined
      ? { credits: parsed.data.creditsUsed }
      : {}),
  };
};

const buildHeaders = (
  config: FirecrawlSearchConfig,
): Record<string, string> => ({
  "Content-Type": "application/json",
  ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {}),
  ...(config.headers ?? {}),
});

const searchFirecrawl = async (
  config: FirecrawlSearchConfig,
  queryText: string,
  ctx: SearchProviderContext,
): Promise<SearchProviderResult> => {
  const endpoint = `${config.baseUrl.replace(/\/$/, "")}/v2/search`;
  const response = await ctx.gotClient.post(endpoint, {
    json: {
      query: queryText,
      limit: RESULTS_PER_QUERY,
      sources: [{ type: "news" }],
      tbs: FIRECRAWL_RECENCY_TBS,
      country: ctx.locale.gl,
    },
    headers: buildHeaders(config),
    timeout: { request: ctx.timeoutMs },
  });

  return parseFirecrawlResponse(JSON.parse(response.body));
};

/**
 * Creates a Firecrawl cloud news search provider.
 *
 * @param config - Firecrawl API key and optional base-URL override.
 */
export const createFirecrawlSearchProvider = (config: {
  apiKey: string;
  baseUrl?: string;
}): SearchProvider => ({
  type: "firecrawl",
  search: (queryText, ctx) =>
    searchFirecrawl(
      {
        baseUrl: config.baseUrl ?? FIRECRAWL_CLOUD_BASE_URL,
        apiKey: config.apiKey,
      },
      queryText,
      ctx,
    ),
});

/**
 * Creates a self-hosted Firecrawl news search provider.
 *
 * @param config - Self-hosted base URL and operator-supplied auth headers.
 */
export const createFirecrawlSelfhostedSearchProvider = (config: {
  baseUrl: string;
  headers?: Record<string, string>;
}): SearchProvider => ({
  type: "firecrawl_selfhosted",
  search: (queryText, ctx) =>
    searchFirecrawl(
      {
        baseUrl: config.baseUrl,
        ...(config.headers ? { headers: config.headers } : {}),
      },
      queryText,
      ctx,
    ),
});
