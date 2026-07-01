import { z } from "zod";

import { retryFetch } from "./retry";

import type {
  FetchProvider,
  FetchProviderConfig,
  NormalizedFetchData,
  ProviderRequestContext,
} from "./types";

/** Zod schema for Jina AI Reader API response data object. */
const jinaDataSchema = z.object({
  url: z.string().url().optional(),
  title: z.string().optional(),
  content: z.string().optional(),
  author: z.string().optional(),
  publishedTime: z.string().optional(),
  published_at: z.string().optional(),
  usage: z
    .object({
      tokens: z.number().optional(),
    })
    .optional(),
});

/** Zod schema for Jina AI Reader API response. */
export const jinaResponseSchema = z.object({
  data: jinaDataSchema.optional(),
});

/**
 * Builds bearer or custom auth headers from provider authentication config.
 *
 * @param config - Provider authentication settings.
 */
const buildAuthHeaders = (
  config: FetchProviderConfig,
): Record<string, string> => {
  const headers: Record<string, string> = {};
  if (config.authentication.apiKey && config.authentication.headerName) {
    const prefix = config.authentication.type === "bearer" ? "Bearer " : "";
    headers[config.authentication.headerName] =
      `${prefix}${config.authentication.apiKey}`;
  }
  return headers;
};

/**
 * Parses and validates a Jina Reader response body.
 *
 * @param raw - Parsed JSON body from the HTTP response.
 */
const parseJinaResponse = (raw: unknown): NormalizedFetchData => {
  const parsed = jinaResponseSchema.safeParse(raw);
  if (!parsed.success) {
    throw parsed.error;
  }

  const data = parsed.data.data;
  if (!data || !data.content || data.content.trim() === "") {
    throw new Error("Semantic validation failed");
  }

  return {
    ...(data.url ? { url: data.url } : {}),
    ...(data.title ? { title: data.title } : {}),
    content: data.content,
    ...(data.author ? { author: data.author } : {}),
    ...(data.publishedTime ? { publishedTime: data.publishedTime } : {}),
    ...(data.published_at ? { published_at: data.published_at } : {}),
    ...(data.usage ? { usage: data.usage } : {}),
  };
};

/**
 * Executes one Jina Reader fetch for a URL.
 *
 * @param url - Target page URL.
 * @param config - Jina provider configuration.
 * @param ctx - Shared request context.
 */
const fetchOneJina = async (
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
    return parseJinaResponse(raw);
  };

  return config.retry
    ? await retryFetch(fetchTask, config.retry, ctx)
    : await fetchTask();
};

/**
 * Creates a Jina Reader fetch provider adapter.
 *
 * @param config - Jina provider configuration.
 */
export const createJinaFetchProvider = (
  config: FetchProviderConfig,
): FetchProvider => ({
  type: "jina",
  fetchOne: (url, ctx) => fetchOneJina(url, config, ctx),
});
