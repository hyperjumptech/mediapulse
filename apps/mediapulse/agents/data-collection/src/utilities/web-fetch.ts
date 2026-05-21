import got from "got";
import { z } from "zod";
import { logger as defaultLogger } from "@workspace/logger";
import { RateLimiter, type StageThrottleStats, withRetry } from "./resilience";
import { classifyError, isRetryableError } from "./error-classification";
import { pMap } from "./p-map";

import type { WebSearchResult } from "./web-search";
import type { ConfigSchemaType } from "./config-schema";
import type { DataCollectionFailure } from "@workspace/agent-data-api-contract";
import type { HostErrorTracker } from "./host-error-tracker";
import { hostFromUrl } from "./host-error-tracker";

export interface WebFetchSuccess {
  success: true;
  data: WebSearchResult;
}

export interface WebFetchFailure {
  success: false;
  url: string;
  queryId: string;
  tickerId: string;
  errorCategory: DataCollectionFailure["errorCategory"];
  message: string;
  retryable: boolean;
  httpStatus?: number;
}

export type WebFetchAttemptResult = WebFetchSuccess | WebFetchFailure;

/** Minimal structured logger for web-fetch (e.g. pino or pino child). */
export type WebFetchLogger = {
  info: (obj: object, msg?: string) => void;
  warn: (obj: object, msg?: string) => void;
};

export interface WebFetchDeps {
  config: NonNullable<ConfigSchemaType["webFetch"]>;
  gotClient?: typeof got;
  /** Logger with run correlation; defaults to workspace logger. */
  logger?: WebFetchLogger;
  /** Optional counter mutated with adaptive throttle events for this stage. */
  throttleStats?: StageThrottleStats;
  /** Optional per-run host error tracker updated on every fetch attempt. */
  hostErrorTracker?: HostErrorTracker;
}

/**
 * Truncates a URL for log fields so long query strings do not flood logs.
 *
 * @param url - Full URL.
 * @param maxChars - Maximum length before truncation.
 * @returns Shortened URL with an ellipsis when truncated.
 */
function truncateUrlForLog(url: string, maxChars = 120): string {
  if (url.length <= maxChars) {
    return url;
  }
  return `${url.slice(0, maxChars)}…`;
}

/** Zod schema for Jina AI Reader API response data object. */
const jinaDataSchema = z.object({
  url: z.string().url().optional(),
  title: z.string().optional(),
  content: z.string().optional(),
  publishedTime: z.string().optional(),
  published_at: z.string().optional(),
  usage: z
    .object({
      tokens: z.number().optional(),
    })
    .optional(),
});

/** Zod schema for Jina AI Reader API response. */
export const webFetchResponseSchema = z.object({
  data: jinaDataSchema.optional(),
});

export type WebFetchResponse = z.infer<typeof webFetchResponseSchema>;

/**
 * Resolves effective mapper concurrency capped by the configured rate limit.
 *
 * @param config - Web fetch provider configuration.
 */
const resolveFetchConcurrency = (
  config: NonNullable<ConfigSchemaType["webFetch"]>,
): number => Math.min(config.concurrency ?? 4, config.rateLimit.requests);

/**
 * Fetches one search hit and returns the attempt result.
 *
 * @param result - Search hit to fetch.
 * @param deps - Shared dependencies for the fetch stage.
 */
const fetchOneResult = async (
  result: WebSearchResult,
  deps: {
    config: NonNullable<ConfigSchemaType["webFetch"]>;
    gotClient: typeof got;
    log: WebFetchLogger;
    rateLimiter: RateLimiter;
    authHeaders: Record<string, string>;
    endpoint: string;
    hostErrorTracker?: HostErrorTracker;
  },
): Promise<WebFetchAttemptResult> => {
  const {
    config,
    gotClient,
    log,
    rateLimiter,
    authHeaders,
    endpoint,
    hostErrorTracker,
  } = deps;

  try {
    await rateLimiter.acquire();

    const fetchTask = async () => {
      const response = await gotClient.post(endpoint, {
        json: { url: result.url },
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          ...authHeaders,
        },
        timeout: config.timeoutMs ? { request: config.timeoutMs } : undefined,
      });
      rateLimiter.recordResponse(response.statusCode);
      const raw = JSON.parse(response.body) as unknown;

      const parsed = webFetchResponseSchema.safeParse(raw);
      if (!parsed.success) {
        throw parsed.error;
      }

      const data = parsed.data.data;
      if (!data || !data.content || data.content.trim() === "") {
        throw new Error("Semantic validation failed");
      }

      return data;
    };

    const data = config.retry
      ? await withRetry(fetchTask, config.retry, isRetryableError)
      : await fetchTask();

    hostErrorTracker?.record(hostFromUrl(result.url), true);

    const jinaMetadata = {
      ...(data.publishedTime ? { publishedTime: data.publishedTime } : {}),
      ...(data.published_at ? { published_at: data.published_at } : {}),
      ...(data.usage ? { usage: data.usage } : {}),
    };

    return {
      success: true,
      data: {
        url: data.url ?? result.url,
        title: data.title ?? result.title,
        content: data.content ?? "",
        tickerId: result.tickerId,
        searchQueryId: result.searchQueryId,
        searchQueryText: result.searchQueryText,
        serpIndex: result.serpIndex,
        ...(Object.keys(jinaMetadata).length > 0 ? { jinaMetadata } : {}),
      },
    };
  } catch (error) {
    const classified = classifyError(error);
    rateLimiter.recordResponse(classified.httpStatus);
    hostErrorTracker?.record(hostFromUrl(result.url), false);
    log.warn(
      {
        searchQueryId: result.searchQueryId,
        url: truncateUrlForLog(result.url),
        errorCategory: classified.category,
        retryable: isRetryableError(error),
        ...(classified.httpStatus !== undefined
          ? { httpStatus: classified.httpStatus }
          : {}),
      },
      "web fetch: URL failed",
    );
    return {
      success: false,
      url: result.url,
      queryId: result.searchQueryId,
      tickerId: result.tickerId,
      errorCategory: classified.category,
      message: classified.message,
      retryable: isRetryableError(error),
      httpStatus: classified.httpStatus,
    };
  }
};

/**
 * Fetches and enriches web page contents for each search result using the Jina AI API.
 * Uses config-driven limits, retries, and yields partial success items.
 *
 * @param searchResults - Search results without full content.
 * @param deps - Dependencies including runtime configuration and optional correlated `logger`.
 * @returns A list of web fetch attempt results.
 */
export async function performWebFetch(
  searchResults: WebSearchResult[],
  deps: WebFetchDeps,
): Promise<WebFetchAttemptResult[]> {
  const { config, gotClient = got, logger: logOpt, throttleStats } = deps;
  const log = logOpt ?? defaultLogger;

  log.info({ urlCount: searchResults.length }, "web fetch: starting");

  const rateLimiter = new RateLimiter(
    config.rateLimit.requests,
    config.rateLimit.perSeconds,
  );

  const authHeaders: Record<string, string> = {};
  if (config.authentication.apiKey && config.authentication.headerName) {
    const prefix = config.authentication.type === "bearer" ? "Bearer " : "";
    authHeaders[config.authentication.headerName] =
      `${prefix}${config.authentication.apiKey}`;
  }

  const endpoint = config.baseUrl;
  const concurrency = resolveFetchConcurrency(config);
  const sharedDeps = {
    config,
    gotClient,
    log,
    rateLimiter,
    authHeaders,
    endpoint,
    hostErrorTracker: deps.hostErrorTracker,
  };

  const results = await pMap(
    searchResults,
    (result) => fetchOneResult(result, sharedDeps),
    { concurrency },
  );

  if (throttleStats) {
    throttleStats.throttleEvents += rateLimiter.getThrottleEvents();
  }

  return results;
}
