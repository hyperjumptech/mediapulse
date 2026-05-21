import got from "got";
import { z } from "zod";
import { logger as defaultLogger } from "@workspace/logger";
import { RateLimiter, type StageThrottleStats, withRetry } from "./resilience";
import { classifyError, isRetryableError } from "./error-classification";
import { pMap } from "./p-map";
import type { ConfigSchemaType } from "./config-schema";
import type { DataCollectionFailure } from "@workspace/agent-data-api-contract";

export interface SearchQuery {
  id: string;
  text: string;
  tickerId: string;
}

export interface WebSearchResult {
  url: string;
  title: string;
  content: string;
  tickerId: string;
  searchQueryId: string;
  searchQueryText: string;
  serpIndex: number;
}

export interface WebSearchSuccess {
  success: true;
  data: WebSearchResult;
}

export interface WebSearchFailure {
  success: false;
  queryId: string;
  queryText: string;
  tickerId: string;
  errorCategory: DataCollectionFailure["errorCategory"];
  message: string;
  retryable: boolean;
  httpStatus?: number;
}

export type WebSearchAttemptResult = WebSearchSuccess | WebSearchFailure;

/** Minimal structured logger for web-search (e.g. pino or pino child). */
export type WebSearchLogger = {
  info: (obj: object, msg?: string) => void;
  warn: (obj: object, msg?: string) => void;
};

export interface WebSearchDeps {
  config: NonNullable<ConfigSchemaType["webSearch"]>;
  gotClient?: typeof got;
  /** Logger with run correlation; defaults to workspace logger. */
  logger?: WebSearchLogger;
  /** Optional counter mutated with adaptive throttle events for this stage. */
  throttleStats?: StageThrottleStats;
}

/** Zod schema for Serper.dev API organic search result item. */
const serperOrganicItemSchema = z.object({
  link: z.string().url().optional(),
  title: z.string().optional(),
  snippet: z.string().optional(),
});

/** Zod schema for Serper.dev API search response. */
export const serperResponseSchema = z.object({
  organic: z.array(serperOrganicItemSchema).optional(),
});

export type SerperResponse = z.infer<typeof serperResponseSchema>;

/**
 * Resolves effective mapper concurrency capped by the configured rate limit.
 *
 * @param config - Web search provider configuration.
 */
const resolveSearchConcurrency = (
  config: NonNullable<ConfigSchemaType["webSearch"]>,
): number => Math.min(config.concurrency ?? 4, config.rateLimit.requests);

/**
 * Executes one Serper query and returns attempt results for that query.
 *
 * @param query - Search query row from the Agent Data API.
 * @param deps - Shared dependencies for the search stage.
 */
const searchOneQuery = async (
  query: SearchQuery,
  deps: {
    config: NonNullable<ConfigSchemaType["webSearch"]>;
    gotClient: typeof got;
    log: WebSearchLogger;
    rateLimiter: RateLimiter;
    authHeaders: Record<string, string>;
  },
): Promise<WebSearchAttemptResult[]> => {
  const { config, gotClient, log, rateLimiter, authHeaders } = deps;

  try {
    await rateLimiter.acquire();

    const fetchTask = async () => {
      const response = await gotClient.post(config.baseUrl, {
        json: { q: query.text },
        headers: {
          "Content-Type": "application/json",
          ...authHeaders,
        },
        timeout: config.timeoutMs ? { request: config.timeoutMs } : undefined,
      });
      rateLimiter.recordResponse(response.statusCode);
      const raw = JSON.parse(response.body) as unknown;

      const parsed = serperResponseSchema.safeParse(raw);
      if (!parsed.success) {
        throw parsed.error;
      }

      const organic = parsed.data.organic ?? [];
      if (organic.length === 0) {
        throw new Error("Semantic validation failed");
      }
      return organic;
    };

    const organic = config.retry
      ? await withRetry(fetchTask, config.retry, isRetryableError)
      : await fetchTask();

    const queryResults: WebSearchAttemptResult[] = [];
    for (const [serpIndex, item] of organic.entries()) {
      if (!item.link) {
        continue;
      }
      queryResults.push({
        success: true,
        data: {
          url: item.link,
          title: item.title ?? "",
          content: item.snippet ?? "",
          tickerId: query.tickerId,
          searchQueryId: query.id,
          searchQueryText: query.text,
          serpIndex,
        },
      });
    }
    return queryResults;
  } catch (error) {
    const classified = classifyError(error);
    rateLimiter.recordResponse(classified.httpStatus);
    log.warn(
      {
        queryId: query.id,
        errorCategory: classified.category,
        retryable: isRetryableError(error),
        ...(classified.httpStatus !== undefined
          ? { httpStatus: classified.httpStatus }
          : {}),
      },
      "web search: query failed",
    );
    return [
      {
        success: false,
        queryId: query.id,
        queryText: query.text,
        tickerId: query.tickerId,
        errorCategory: classified.category,
        message: classified.message,
        retryable: isRetryableError(error),
        httpStatus: classified.httpStatus,
      },
    ];
  }
};

/**
 * Performs web search for each query using the configured provider.
 * Uses config-driven limits, retries, and yields partial success items.
 *
 * @param queries - Search queries retrieved from the Agent Data API.
 * @param deps - Dependencies including runtime configuration and optional correlated `logger`.
 * @returns A list of web search attempt results.
 */
export async function performWebSearch(
  queries: SearchQuery[],
  deps: WebSearchDeps,
): Promise<WebSearchAttemptResult[]> {
  const { config, gotClient = got, logger: logOpt, throttleStats } = deps;
  const log = logOpt ?? defaultLogger;

  log.info({ queryCount: queries.length }, "web search: starting");

  try {
    const hostname = new URL(config.baseUrl).hostname;
    if (hostname === "r.jina.ai" || hostname.endsWith(".jina.ai")) {
      log.warn(
        {
          baseUrl: config.baseUrl,
          hint: "webSearch uses Serper-shaped POST { q }; Jina Reader belongs on webFetch.baseUrl",
        },
        "data-collection webSearch misconfiguration: Jina URL in webSearch.baseUrl",
      );
    }
  } catch {
    // Invalid baseUrl: the HTTP client will fail with a clearer error.
  }

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

  const concurrency = resolveSearchConcurrency(config);
  const sharedDeps = {
    config,
    gotClient,
    log,
    rateLimiter,
    authHeaders,
  };

  const perQueryResults = await pMap(
    queries,
    (query) => searchOneQuery(query, sharedDeps),
    { concurrency },
  );

  if (throttleStats) {
    throttleStats.throttleEvents += rateLimiter.getThrottleEvents();
  }

  return perQueryResults.flat();
}
