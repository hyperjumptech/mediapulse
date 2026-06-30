import { z } from "zod";

import { withRetry } from "../resilience";
import { isRetryableError } from "../error-classification";

import type {
  FetchProvider,
  FetchProviderConfig,
  NormalizedFetchData,
  ProviderRequestContext,
} from "./types";

/** Zod schema for Diffbot article API response. */
const diffbotResponseSchema = z.object({
  objects: z
    .array(
      z.object({
        text: z.string().optional(),
        title: z.string().optional(),
        date: z.string().optional(),
        author: z.string().optional(),
        siteName: z.string().optional(),
      }),
    )
    .optional(),
});

/**
 * Parses and validates a Diffbot article response body.
 *
 * @param raw - Parsed JSON body from the HTTP response.
 */
const parseDiffbotResponse = (raw: unknown): NormalizedFetchData => {
  const parsed = diffbotResponseSchema.safeParse(raw);
  if (!parsed.success) {
    throw parsed.error;
  }

  const firstObject = parsed.data.objects?.[0];
  if (!firstObject?.text || firstObject.text.trim() === "") {
    throw new Error("Semantic validation failed");
  }

  return {
    content: firstObject.text,
    ...(firstObject.title ? { title: firstObject.title } : {}),
    ...(firstObject.author ? { author: firstObject.author } : {}),
    ...(firstObject.siteName ? { source: firstObject.siteName } : {}),
    ...(firstObject.date ? { publishedTime: firstObject.date } : {}),
  };
};

/**
 * Builds the Diffbot article endpoint with token query parameter auth.
 *
 * @param config - Diffbot provider configuration.
 * @param url - Target page URL.
 */
const buildDiffbotEndpoint = (
  config: FetchProviderConfig,
  url: string,
): string => {
  const baseUrl = config.baseUrl.replace(/\/$/, "");
  const endpoint = new URL(`${baseUrl}/v3/article`);
  if (config.authentication.apiKey) {
    endpoint.searchParams.set("token", config.authentication.apiKey);
  }
  endpoint.searchParams.set("url", url);
  return endpoint.toString();
};

/**
 * Executes one Diffbot article fetch for a URL.
 *
 * @param url - Target page URL.
 * @param config - Diffbot provider configuration.
 * @param ctx - Shared request context.
 */
const fetchOneDiffbot = async (
  url: string,
  config: FetchProviderConfig,
  ctx: ProviderRequestContext,
): Promise<NormalizedFetchData> => {
  await ctx.rateLimiter.acquire();

  const fetchTask = async () => {
    const response = await ctx.gotClient.get(
      buildDiffbotEndpoint(config, url),
      {
        headers: {
          Accept: "application/json",
        },
        timeout: config.timeoutMs ? { request: config.timeoutMs } : undefined,
        retry: { limit: 0 },
        signal: ctx.signal,
      },
    );
    ctx.rateLimiter.recordResponse(response.statusCode);
    const raw = JSON.parse(response.body) as unknown;
    return parseDiffbotResponse(raw);
  };

  return config.retry
    ? await withRetry(fetchTask, config.retry, isRetryableError)
    : await fetchTask();
};

/**
 * Creates a Diffbot fetch provider adapter.
 *
 * @param config - Diffbot provider configuration.
 */
export const createDiffbotFetchProvider = (
  config: FetchProviderConfig,
): FetchProvider => ({
  type: "diffbot",
  fetchOne: (url, ctx) => fetchOneDiffbot(url, config, ctx),
});
