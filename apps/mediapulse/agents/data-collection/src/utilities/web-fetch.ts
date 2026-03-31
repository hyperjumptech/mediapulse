import got from "got";
import { z } from "zod";
import { logger as defaultLogger } from "@workspace/logger";
import { RateLimiter, withRetry } from "./resilience";
import { classifyError, isRetryableError } from "./error-classification";

import type { WebSearchResult } from "./web-search";
import type { ConfigSchemaType } from "./config-schema";
import type { DataCollectionFailure } from "@workspace/agent-data-api-contract";

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
});

/** Zod schema for Jina AI Reader API response. */
export const webFetchResponseSchema = z.object({
  data: jinaDataSchema.optional(),
});

export type WebFetchResponse = z.infer<typeof webFetchResponseSchema>;

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
  const { config, gotClient = got, logger: logOpt } = deps;
  const log = logOpt ?? defaultLogger;
  const results: WebFetchAttemptResult[] = [];

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

  // ensure trailing slash if required by fetcher or handle path correctly
  const endpoint = config.baseUrl;

  for (const result of searchResults) {
    try {
      await rateLimiter.acquire();

      const fetchTask = async () => {
        const raw = await gotClient
          .post(endpoint, {
            json: { url: result.url },
            headers: {
              Accept: "application/json",
              "Content-Type": "application/json",
              ...authHeaders,
            },
            timeout: config.timeoutMs
              ? { request: config.timeoutMs }
              : undefined,
          })
          .json<unknown>();

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

      results.push({
        success: true,
        data: {
          url: data.url ?? result.url,
          title: data.title ?? result.title,
          content: data.content ?? "",
          tickerId: result.tickerId,
          searchQueryId: result.searchQueryId,
          searchQueryText: result.searchQueryText,
        },
      });
    } catch (e) {
      const classified = classifyError(e);
      log.warn(
        {
          searchQueryId: result.searchQueryId,
          url: truncateUrlForLog(result.url),
          errorCategory: classified.category,
          retryable: isRetryableError(e),
          ...(classified.httpStatus !== undefined
            ? { httpStatus: classified.httpStatus }
            : {}),
        },
        "web fetch: URL failed",
      );
      results.push({
        success: false,
        url: result.url,
        queryId: result.searchQueryId,
        tickerId: result.tickerId,
        errorCategory: classified.category,
        message: classified.message,
        retryable: isRetryableError(e),
        httpStatus: classified.httpStatus,
      });
    }
  }

  return results;
}
