import { z } from "zod";

import { retryFetch } from "./retry";

import type {
  FetchProvider,
  FetchProviderConfig,
  NormalizedFetchData,
  ProviderRequestContext,
} from "./types";

/** Zod schema for the Exa contents API response. */
const exaResponseSchema = z.object({
  results: z
    .array(
      z.object({
        text: z.string().optional(),
        title: z.string().optional(),
        author: z.string().optional(),
        publishedDate: z.string().optional(),
      }),
    )
    .optional(),
});

/**
 * Parses and validates an Exa contents response body into plain text content.
 *
 * @param raw - Parsed JSON body from the HTTP response.
 */
const parseExaResponse = (raw: unknown): NormalizedFetchData => {
  const parsed = exaResponseSchema.safeParse(raw);
  if (!parsed.success) {
    throw parsed.error;
  }

  const result = parsed.data.results?.[0];
  const content = result?.text;
  if (!content || content.trim() === "") {
    throw new Error("Semantic validation failed");
  }

  return {
    content,
    ...(result.title ? { title: result.title } : {}),
    ...(result.author ? { author: result.author } : {}),
    ...(result.publishedDate ? { publishedTime: result.publishedDate } : {}),
  };
};

/**
 * Executes one Exa contents request for a URL.
 *
 * @param url - Target page URL.
 * @param config - Exa provider configuration.
 * @param ctx - Shared request context.
 */
const fetchOneExa = async (
  url: string,
  config: FetchProviderConfig,
  ctx: ProviderRequestContext,
): Promise<NormalizedFetchData> => {
  const fetchTask = async () => {
    await ctx.rateLimiter.acquire();
    const response = await ctx.gotClient.post(config.baseUrl, {
      json: { urls: [url], text: true },
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(config.authentication.apiKey
          ? { "x-api-key": config.authentication.apiKey }
          : {}),
      },
      timeout: config.timeoutMs ? { request: config.timeoutMs } : undefined,
      retry: { limit: 0 },
      signal: ctx.signal,
    });
    ctx.rateLimiter.recordResponse(response.statusCode);
    const raw = JSON.parse(response.body) as unknown;
    return parseExaResponse(raw);
  };

  return config.retry
    ? await retryFetch(fetchTask, config.retry, ctx)
    : await fetchTask();
};

/**
 * Creates an Exa contents fetch provider adapter.
 *
 * @param config - Exa provider configuration.
 */
export const createExaFetchProvider = (
  config: FetchProviderConfig,
): FetchProvider => ({
  type: "exa",
  fetchOne: (url, ctx) => fetchOneExa(url, config, ctx),
});
