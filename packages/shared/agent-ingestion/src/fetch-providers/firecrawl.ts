import { z } from "zod";

import { withRetry } from "../resilience";
import { isRetryableError } from "../error-classification";

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
  await ctx.rateLimiter.acquire();

  const endpoint = `${config.baseUrl.replace(/\/$/, "")}/v1/scrape`;
  const fetchTask = async () => {
    const response = await ctx.gotClient.post(endpoint, {
      json: { url, formats: ["markdown"] },
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...buildAuthHeaders(config),
      },
      timeout: config.timeoutMs ? { request: config.timeoutMs } : undefined,
    });
    ctx.rateLimiter.recordResponse(response.statusCode);
    const raw = JSON.parse(response.body) as unknown;
    return parseFirecrawlResponse(raw);
  };

  return config.retry
    ? await withRetry(fetchTask, config.retry, isRetryableError)
    : await fetchTask();
};

/**
 * Creates a Firecrawl fetch provider adapter.
 *
 * @param config - Firecrawl provider configuration.
 */
export const createFirecrawlFetchProvider = (
  config: FetchProviderConfig,
): FetchProvider => ({
  type: "firecrawl",
  fetchOne: (url, ctx) => fetchOneFirecrawl(url, config, ctx),
});
