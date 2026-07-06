import got from "got";
import { logger as defaultLogger } from "@workspace/logger";
import { pMap } from "@workspace/agent-ingestion";
import type { FetchMetadata } from "@workspace/agent-ingestion";
import type { DataCollectionFailure } from "@workspace/agent-data-api-contract";
import {
  AllProvidersFailed,
  createSearchProvider,
  dispatch,
  RoundRobinCursor,
  type DispatchProvider,
  type SearchProvider,
  type SearchProviderResult,
} from "@workspace/agent-search";

import type { SearchLocale, WebSearchConfig } from "./config-schema";

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
  provider: DataCollectionFailure["provider"];
  errorCategory: DataCollectionFailure["errorCategory"];
  message: string;
  retryable: boolean;
  httpStatus?: number;
}

/** A provider returned a valid response but no items for this query — not a failure. */
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
  /** Round-robin search provider pool (one entry per configured provider). */
  config: WebSearchConfig;
  /** Locales the query fans out across. */
  locales: SearchLocale[];
  /** Zero-based round index; advances pagination on repeat rounds. */
  page?: number;
  /** Shared round-robin cursor so rotation persists across queries and rounds. */
  cursor?: RoundRobinCursor;
  gotClient?: typeof got;
  /** Logger with run correlation; defaults to workspace logger. */
  logger?: WebSearchLogger;
  /**
   * Chronicle instrumentation sink: provider-reported search credits are summed
   * into `credits` across every query/locale/round when provided.
   */
  creditsSink?: { credits: number };
}

const SEARCH_TIMEOUT_MS = 30_000;

/** A built provider plus its display name, reused across all queries. */
interface BuiltSearchProvider {
  name: DataCollectionFailure["provider"];
  provider: SearchProvider;
}

/**
 * Runs one query against one locale through the round-robin provider pool.
 *
 * @param query - Search query row from the Agent Data API.
 * @param locale - Locale for this fan-out request.
 * @param deps - Shared search dependencies.
 */
const searchOne = async (
  query: SearchQuery,
  locale: SearchLocale,
  deps: {
    providers: BuiltSearchProvider[];
    page: number;
    cursor: RoundRobinCursor;
    gotClient: typeof got;
    log: WebSearchLogger;
    creditsSink?: { credits: number };
  },
): Promise<WebSearchAttemptResult[]> => {
  const { providers, page, cursor, gotClient, log, creditsSink } = deps;

  const dispatchProviders: DispatchProvider<SearchProviderResult>[] =
    providers.map((built) => ({
      name: built.name,
      run: () =>
        built.provider.search(query.text, {
          gotClient,
          locale,
          page,
          timeoutMs: SEARCH_TIMEOUT_MS,
          logger: log,
        }),
    }));

  try {
    const result = await dispatch(
      "search",
      dispatchProviders,
      (candidate) => candidate.hits.length > 0,
      cursor,
    );
    if (creditsSink !== undefined && result.credits !== undefined) {
      creditsSink.credits += result.credits;
    }
    const hits = result.hits;

    if (hits.length === 0) {
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

    return hits.map((hit, serpIndex) => ({
      success: true,
      data: {
        url: hit.url,
        title: hit.title,
        content: hit.snippet,
        tickerId: query.tickerId,
        searchQueryId: query.id,
        searchQueryText: query.text,
        serpIndex,
      },
    }));
  } catch (error) {
    const failed = error instanceof AllProvidersFailed ? error : undefined;
    const provider = failed?.errors[0]?.provider as
      | DataCollectionFailure["provider"]
      | undefined;
    const message =
      error instanceof Error ? error.message : "web search failed";
    log.warn(
      { queryId: query.id, gl: locale.gl, message },
      "web search: all providers failed",
    );

    return [
      {
        success: false,
        queryId: query.id,
        queryText: query.text,
        tickerId: query.tickerId,
        provider: provider ?? "serper",
        errorCategory: "provider_http_error",
        message,
        retryable: true,
      },
    ];
  }
};

/**
 * Performs web search for each query across every configured locale, using a
 * round-robin provider pool with failover.
 *
 * @param queries - Search queries retrieved from the Agent Data API.
 * @param deps - Runtime configuration, locales, pagination, and shared cursor.
 * @returns A flat list of web search attempt results across queries and locales.
 */
export async function performWebSearch(
  queries: SearchQuery[],
  deps: WebSearchDeps,
): Promise<WebSearchAttemptResult[]> {
  const {
    config,
    locales,
    gotClient = got,
    logger: logOpt,
    creditsSink,
  } = deps;
  const log = logOpt ?? defaultLogger;
  const page = deps.page ?? 0;
  const cursor = deps.cursor ?? new RoundRobinCursor();

  const providers: BuiltSearchProvider[] = config.map((entry) => ({
    name: entry.provider,
    provider: createSearchProvider(entry),
  }));

  log.info(
    {
      queryCount: queries.length,
      localeCount: locales.length,
      providers: providers.map((built) => built.name),
      page,
    },
    "web search: starting",
  );

  const tasks: Array<{ query: SearchQuery; locale: SearchLocale }> = [];
  for (const query of queries) {
    for (const locale of locales) {
      tasks.push({ query, locale });
    }
  }

  const perTaskResults = await pMap(
    tasks,
    (task) =>
      searchOne(task.query, task.locale, {
        providers,
        page,
        cursor,
        gotClient,
        log,
        ...(creditsSink !== undefined ? { creditsSink } : {}),
      }),
    { concurrency: 4 },
  );

  return perTaskResults.flat();
}
