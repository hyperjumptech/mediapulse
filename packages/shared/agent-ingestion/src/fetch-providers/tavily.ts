import { z } from "zod";

import { retryFetch } from "./retry";

import type {
  FetchProvider,
  FetchProviderConfig,
  NormalizedFetchData,
  ProviderRequestContext,
} from "./types";

/** Zod schema for the Tavily extract API response. */
const tavilyResponseSchema = z.object({
  results: z
    .array(
      z.object({
        raw_content: z.string().optional(),
      }),
    )
    .optional(),
});

/**
 * Parses and validates a Tavily extract response body into plain text content.
 *
 * @param raw - Parsed JSON body from the HTTP response.
 */
const parseTavilyResponse = (raw: unknown): NormalizedFetchData => {
  const parsed = tavilyResponseSchema.safeParse(raw);
  if (!parsed.success) {
    throw parsed.error;
  }

  const content = parsed.data.results?.[0]?.raw_content;
  if (!content || content.trim() === "") {
    throw new Error("Semantic validation failed");
  }

  return { content };
};

/**
 * Executes one Tavily extract for a URL.
 *
 * @param url - Target page URL.
 * @param config - Tavily provider configuration.
 * @param ctx - Shared request context.
 */
const fetchOneTavily = async (
  url: string,
  config: FetchProviderConfig,
  ctx: ProviderRequestContext,
): Promise<NormalizedFetchData> => {
  const fetchTask = async () => {
    await ctx.rateLimiter.acquire();
    const response = await ctx.gotClient.post(config.baseUrl, {
      json: { urls: [url] },
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(config.authentication.apiKey
          ? { Authorization: `Bearer ${config.authentication.apiKey}` }
          : {}),
      },
      timeout: config.timeoutMs ? { request: config.timeoutMs } : undefined,
      retry: { limit: 0 },
      signal: ctx.signal,
    });
    ctx.rateLimiter.recordResponse(response.statusCode);
    const raw = JSON.parse(response.body) as unknown;
    return parseTavilyResponse(raw);
  };

  return config.retry
    ? await retryFetch(fetchTask, config.retry, ctx)
    : await fetchTask();
};

/**
 * Creates a Tavily extract fetch provider adapter.
 *
 * @param config - Tavily provider configuration.
 */
export const createTavilyFetchProvider = (
  config: FetchProviderConfig,
): FetchProvider => ({
  type: "tavily",
  fetchOne: (url, ctx) => fetchOneTavily(url, config, ctx),
});
