import { z } from "zod";

import { withRetry } from "../resilience";
import { isRetryableError } from "../error-classification";

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
  await ctx.rateLimiter.acquire();

  const fetchTask = async () => {
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
    });
    ctx.rateLimiter.recordResponse(response.statusCode);
    const raw = JSON.parse(response.body) as unknown;
    return parseTavilyResponse(raw);
  };

  return config.retry
    ? await withRetry(fetchTask, config.retry, isRetryableError)
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
