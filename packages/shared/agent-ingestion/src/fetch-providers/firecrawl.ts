import { z } from "zod";

import { retryFetch } from "./retry";

import type {
  FetchProvider,
  FetchProviderConfig,
  NormalizedFetchData,
  ProviderRequestContext,
} from "./types";

/** Zod schema for Firecrawl scrape API response. */
const firecrawlResponseSchema = z.object({
  success: z.boolean(),
  data: z
    .object({
      markdown: z.string().optional(),
      metadata: z
        .object({
          title: z.string().optional(),
          author: z.string().optional(),
          ogSiteName: z.string().optional(),
          publishedTime: z.string().optional(),
        })
        .passthrough()
        .optional(),
    })
    .optional(),
});

/**
 * Builds bearer auth headers for Firecrawl requests.
 *
 * @param config - Firecrawl provider configuration.
 */
const buildAuthHeaders = (
  config: FetchProviderConfig,
): Record<string, string> => {
  const headers: Record<string, string> = {};
  if (config.authentication.apiKey) {
    headers.Authorization = `Bearer ${config.authentication.apiKey}`;
  }
  return headers;
};

/**
 * Parses and validates a Firecrawl scrape response body.
 *
 * @param raw - Parsed JSON body from the HTTP response.
 */
const parseFirecrawlResponse = (raw: unknown): NormalizedFetchData => {
  const parsed = firecrawlResponseSchema.safeParse(raw);
  if (!parsed.success) {
    throw parsed.error;
  }

  if (!parsed.data.success) {
    throw new Error("Semantic validation failed");
  }

  const markdown = parsed.data.data?.markdown;
  if (!markdown || markdown.trim() === "") {
    throw new Error("Semantic validation failed");
  }

  const metadata = parsed.data.data?.metadata;
  return {
    content: markdown,
    ...(metadata?.title ? { title: metadata.title } : {}),
    ...(metadata?.author ? { author: metadata.author } : {}),
    ...(metadata?.ogSiteName ? { source: metadata.ogSiteName } : {}),
    ...(metadata?.publishedTime
      ? { publishedTime: metadata.publishedTime }
      : {}),
  };
};

/**
 * Executes one Firecrawl scrape for a URL.
 *
 * @param url - Target page URL.
 * @param config - Firecrawl provider configuration.
 * @param ctx - Shared request context.
 */
const fetchOneFirecrawl = async (
  url: string,
  config: FetchProviderConfig,
  ctx: ProviderRequestContext,
): Promise<NormalizedFetchData> => {
  const endpoint = `${config.baseUrl.replace(/\/$/, "")}/v2/scrape`;
  const fetchTask = async () => {
    await ctx.rateLimiter.acquire();
    const response = await ctx.gotClient.post(endpoint, {
      json: { url, formats: ["markdown"] },
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...buildAuthHeaders(config),
        ...(config.headers ?? {}),
      },
      timeout: config.timeoutMs ? { request: config.timeoutMs } : undefined,
      retry: { limit: 0 },
      signal: ctx.signal,
    });
    ctx.rateLimiter.recordResponse(response.statusCode);
    const raw = JSON.parse(response.body) as unknown;
    return parseFirecrawlResponse(raw);
  };

  return config.retry
    ? await retryFetch(fetchTask, config.retry, ctx)
    : await fetchTask();
};

/**
 * Creates a Firecrawl fetch provider adapter.
 *
 * Serves both the hosted `firecrawl` provider (bearer auth) and the
 * `firecrawl_selfhosted` provider (custom `baseUrl` and `headers`); the adapter
 * reports `config.type` so failures attribute to the right provider.
 *
 * @param config - Firecrawl provider configuration.
 */
export const createFirecrawlFetchProvider = (
  config: FetchProviderConfig,
): FetchProvider => ({
  type: config.type,
  fetchOne: (url, ctx) => fetchOneFirecrawl(url, config, ctx),
});
