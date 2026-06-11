import got from "got";
import { z } from "zod";
import { logger as defaultLogger } from "@workspace/logger";
import {
  RateLimiter,
  type StageThrottleStats,
  withRetry,
  classifyError,
  isRetryableError,
  pMap,
} from "@workspace/agent-ingestion";
import { buildSerperRequestBody, resolveSerperEndpoint } from "./serper-query";
import type { ConfigSchemaType } from "./config-schema";
import type { DataCollectionFailure } from "@workspace/agent-data-api-contract";

export interface SearchQuery {
  id: string;
  text: string;
  tickerId: string;
}

import type { FetchMetadata } from "@workspace/agent-ingestion";

export interface WebSearchResult {
  url: string;
  title: string;
  content: string;
  tickerId: string;
  searchQueryId: string;
  searchQueryText: string;
  serpIndex: number;
  /** Optional fetch provider metadata captured during web fetch. */
  fetchMetadata?: FetchMetadata;
  /** @deprecated Use {@link WebSearchResult.fetchMetadata} instead. */
  jinaMetadata?: FetchMetadata;
}

export interface WebSearchSuccess {
  success: true;
  data: WebSearchResult;
}

export interface WebSearchFailure {
  success: false;
  empty?: never;
  queryId: string;
  queryText: string;
  tickerId: string;
  errorCategory: DataCollectionFailure["errorCategory"];
  message: string;
  retryable: boolean;
  httpStatus?: number;
}

/** Serper returned a valid response but no items for this query — not a failure. */
export interface WebSearchEmptyResult {
  success: false;
  empty: true;
  queryId: string;
  queryText: string;
  tickerId: string;
}

export type WebSearchAttemptResult =
  | WebSearchSuccess
  | WebSearchFailure
  | WebSearchEmptyResult;

/** Minimal structured logger for web-search (e.g. pino or pino child). */
export type WebSearchLogger = {
  info: (obj: object, msg?: string) => void;
  warn: (obj: object, msg?: string) => void;
};

export interface WebSearchDeps {
  config: ConfigSchemaType["providers"]["search"];
  gotClient?: typeof got;
  /** Logger with run correlation; defaults to workspace logger. */
  logger?: WebSearchLogger;
  /** Optional counter mutated with adaptive throttle events for this stage. */
  throttleStats?: StageThrottleStats;
}

/** Zod schema for Serper.dev API organic search result item. */
const serperOrganicItemSchema = z.object({
  link: z.string().optional(),
  title: z.string().optional(),
  snippet: z.string().optional(),
});

/** Zod schema for Serper.dev API news result item. */
const serperNewsItemSchema = z.object({
  link: z.string().optional(),
  title: z.string().optional(),
  snippet: z.string().optional(),
  date: z.string().optional(),
  source: z.string().optional(),
});

/** Zod schema for Serper.dev API search response. */
export const serperResponseSchema = z.object({
  organic: z.array(serperOrganicItemSchema).optional(),
  news: z.array(serperNewsItemSchema).optional(),
});

export type SerperResponse = z.infer<typeof serperResponseSchema>;

/**
 * Resolves effective mapper concurrency capped by the configured rate limit.
 *
 * @param config - Web search provider configuration.
 */
const resolveSearchConcurrency = (
  config: ConfigSchemaType["providers"]["search"],
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
    config: ConfigSchemaType["providers"]["search"];
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
      const endpoint = resolveSerperEndpoint(config.baseUrl, config.query.type);
      const requestBody = buildSerperRequestBody(query.text, config.query);
      const response = await gotClient.post(endpoint, {
        json: requestBody,
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

      const items =
        config.query.type === "news"
          ? (parsed.data.news ?? [])
          : (parsed.data.organic ?? []);
      return items;
    };

    const serpItems = config.retry
      ? await withRetry(fetchTask, config.retry, isRetryableError)
      : await fetchTask();

    if (serpItems.length === 0) {
      log.info({ queryId: query.id }, "web search: query returned no results");
      return [
        {
          success: false,
          empty: true,
          queryId: query.id,
          queryText: query.text,
          tickerId: query.tickerId,
        },
      ];
    }

    const queryResults: WebSearchAttemptResult[] = [];
    for (const [serpIndex, item] of serpItems.entries()) {
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
          hint: "providers.search uses Serper-shaped POST { q }; Jina Reader belongs in providers.fetch.providers",
        },
        "data-collection search misconfiguration: Jina URL in providers.search.baseUrl",
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
