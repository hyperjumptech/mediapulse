import { z } from "zod";

import { retryFetch } from "./retry";

import type {
  FetchProvider,
  FetchProviderConfig,
  NormalizedFetchData,
  ProviderRequestContext,
} from "./types";

/** Zod schema for the Serper scrape API response. */
const serperResponseSchema = z.object({
  text: z.string().optional(),
  metadata: z
    .object({
      title: z.string().optional(),
      author: z.string().optional(),
      "article:author": z.string().optional(),
      "og:site_name": z.string().optional(),
      "article:published_time": z.string().optional(),
      "article:modified_time": z.string().optional(),
    })
    .passthrough()
    .optional(),
});

/**
 * Builds the API-key header from provider authentication config.
 *
 * @param config - Serper provider configuration.
 */
const buildAuthHeaders = (
  config: FetchProviderConfig,
): Record<string, string> => {
  const headers: Record<string, string> = {};
  if (config.authentication.apiKey && config.authentication.headerName) {
    headers[config.authentication.headerName] = config.authentication.apiKey;
  }
  return headers;
};

/**
 * Parses and validates a Serper scrape response body.
 *
 * @param raw - Parsed JSON body from the HTTP response.
 */
const parseSerperResponse = (raw: unknown): NormalizedFetchData => {
  const parsed = serperResponseSchema.safeParse(raw);
  if (!parsed.success) {
    throw parsed.error;
  }

  const text = parsed.data.text;
  if (!text || text.trim() === "") {
    throw new Error("Semantic validation failed");
  }

  const metadata = parsed.data.metadata;
  const publishedTime = metadata?.["article:published_time"];
  const author = metadata?.author ?? metadata?.["article:author"];
  const source = metadata?.["og:site_name"];
  return {
    content: text,
    ...(metadata?.title ? { title: metadata.title } : {}),
    ...(author ? { author } : {}),
    ...(source ? { source } : {}),
    ...(publishedTime ? { publishedTime } : {}),
  };
};

/**
 * Executes one Serper scrape for a URL.
 *
 * @param url - Target page URL.
 * @param config - Serper provider configuration.
 * @param ctx - Shared request context.
 */
const fetchOneSerper = async (
  url: string,
  config: FetchProviderConfig,
  ctx: ProviderRequestContext,
): Promise<NormalizedFetchData> => {
  const fetchTask = async () => {
    await ctx.rateLimiter.acquire();
    const response = await ctx.gotClient.post(config.baseUrl, {
      json: { url },
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...buildAuthHeaders(config),
      },
      timeout: config.timeoutMs ? { request: config.timeoutMs } : undefined,
      retry: { limit: 0 },
      signal: ctx.signal,
    });
    ctx.rateLimiter.recordResponse(response.statusCode);
    const raw = JSON.parse(response.body) as unknown;
    return parseSerperResponse(raw);
  };

  return config.retry
    ? await retryFetch(fetchTask, config.retry, ctx)
    : await fetchTask();
};

/**
 * Creates a Serper scrape fetch provider adapter.
 *
 * @param config - Serper provider configuration.
 */
export const createSerperFetchProvider = (
  config: FetchProviderConfig,
): FetchProvider => ({
  type: "serper",
  fetchOne: (url, ctx) => fetchOneSerper(url, config, ctx),
});
