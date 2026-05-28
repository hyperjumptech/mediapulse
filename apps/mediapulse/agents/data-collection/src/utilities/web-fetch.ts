import got from "got";

import { logger as defaultLogger } from "@workspace/logger";
import { RateLimiter, type StageThrottleStats } from "./resilience";
import { classifyError, isRetryableError } from "./error-classification";
import { pMap } from "./p-map";
import {
  createFetchProviderChain,
  type FetchProviderConfig,
} from "./fetch-providers/registry";
import type { FetchProvider } from "./fetch-providers/types";

import type { FetchMetadata } from "./date-extractor";
import type { WebSearchResult } from "./web-search";
import type { ConfigSchemaType } from "./config-schema";
import type { DataCollectionFailure } from "@workspace/agent-data-api-contract";
import type { HostErrorTracker } from "./host-error-tracker";
import { hostFromUrl } from "./host-error-tracker";

export type WebFetchProviderName = Extract<
  DataCollectionFailure["provider"],
  "jina" | "firecrawl" | "diffbot"
>;

export type FetchedWebSearchResult = WebSearchResult & {
  provider: WebFetchProviderName;
};

export interface WebFetchFailure {
  url: string;
  queryId: string;
  tickerId: string;
  provider: WebFetchProviderName;
  errorCategory: DataCollectionFailure["errorCategory"];
  message: string;
  retryable: boolean;
  httpStatus?: number;
}

export interface WebFetchOutcome {
  success: FetchedWebSearchResult | null;
  failures: WebFetchFailure[];
}

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

type ProviderChainEntry = {
  provider: FetchProvider;
  config: FetchProviderConfig;
  rateLimiter: RateLimiter;
};

const WEB_FETCH_PROVIDER_NAMES = new Set<WebFetchProviderName>([
  "jina",
  "firecrawl",
  "diffbot",
]);

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

/**
 * Resolves effective mapper concurrency capped by each provider rate limit.
 *
 * @param providers - Ordered provider configs for the fetch chain.
 */
const resolveFetchConcurrency = (providers: FetchProviderConfig[]): number =>
  Math.max(
    ...providers.map((provider) =>
      Math.min(provider.concurrency ?? 4, provider.rateLimit.requests),
    ),
  );

/**
 * Builds fetch metadata from normalized provider fields.
 *
 * @param data - Normalized provider response fields.
 */
const buildFetchMetadata = (data: {
  publishedTime?: string;
  published_at?: string;
  usage?: { tokens?: number };
}): FetchMetadata | undefined => {
  const metadata: FetchMetadata = {
    ...(data.publishedTime ? { publishedTime: data.publishedTime } : {}),
    ...(data.published_at ? { published_at: data.published_at } : {}),
    ...(data.usage ? { usage: data.usage } : {}),
  };

  return Object.keys(metadata).length > 0 ? metadata : undefined;
};

/**
 * Narrows a provider type string to a persisted web-fetch provider name.
 *
 * @param type - Provider adapter type string.
 */
const toWebFetchProviderName = (type: string): WebFetchProviderName => {
  if (!WEB_FETCH_PROVIDER_NAMES.has(type as WebFetchProviderName)) {
    throw new Error(`Unsupported web fetch provider: ${type}`);
  }
  return type as WebFetchProviderName;
};

/**
 * Fetches one search hit through the ordered provider chain.
 *
 * @param result - Search hit to fetch.
 * @param chain - Ordered provider adapters with per-provider rate limiters.
 * @param deps - Shared dependencies for the fetch stage.
 */
const fetchOneResult = async (
  result: WebSearchResult,
  chain: ProviderChainEntry[],
  deps: {
    gotClient: typeof got;
    log: WebFetchLogger;
    hostErrorTracker?: HostErrorTracker;
  },
): Promise<WebFetchOutcome> => {
  const { gotClient, log, hostErrorTracker } = deps;
  const failures: WebFetchFailure[] = [];

  for (const entry of chain) {
    const providerName = toWebFetchProviderName(entry.provider.type);

    try {
      const data = await entry.provider.fetchOne(result.url, {
        gotClient,
        rateLimiter: entry.rateLimiter,
        logger: log,
      });

      hostErrorTracker?.record(hostFromUrl(result.url), true);

      const fetchMetadata = buildFetchMetadata(data);

      return {
        success: {
          url: data.url ?? result.url,
          title: data.title ?? result.title,
          content: data.content,
          tickerId: result.tickerId,
          searchQueryId: result.searchQueryId,
          searchQueryText: result.searchQueryText,
          serpIndex: result.serpIndex,
          provider: providerName,
          ...(fetchMetadata ? { fetchMetadata } : {}),
        },
        failures,
      };
    } catch (error) {
      const classified = classifyError(error);
      entry.rateLimiter.recordResponse(classified.httpStatus);
      log.warn(
        {
          searchQueryId: result.searchQueryId,
          url: truncateUrlForLog(result.url),
          provider: providerName,
          errorCategory: classified.category,
          retryable: isRetryableError(error),
          ...(classified.httpStatus !== undefined
            ? { httpStatus: classified.httpStatus }
            : {}),
        },
        "web fetch: provider failed",
      );
      failures.push({
        url: result.url,
        queryId: result.searchQueryId,
        tickerId: result.tickerId,
        provider: providerName,
        errorCategory: classified.category,
        message: classified.message,
        retryable: isRetryableError(error),
        httpStatus: classified.httpStatus,
      });
    }
  }

  hostErrorTracker?.record(hostFromUrl(result.url), false);

  return {
    success: null,
    failures,
  };
};

/**
 * Builds the ordered provider chain with one rate limiter per provider.
 *
 * @param configs - Ordered provider configs from runtime settings.
 */
const buildProviderChain = (
  configs: FetchProviderConfig[],
): ProviderChainEntry[] => {
  const providers = createFetchProviderChain(configs);

  return providers.map((provider, index) => ({
    provider,
    config: configs[index]!,
    rateLimiter: new RateLimiter(
      configs[index]!.rateLimit.requests,
      configs[index]!.rateLimit.perSeconds,
    ),
  }));
};

/**
 * Fetches and enriches web page contents for each search result using an
 * ordered provider chain with per-provider fallback.
 *
 * @param searchResults - Search results without full content.
 * @param deps - Dependencies including runtime configuration and optional correlated `logger`.
 * @returns One outcome per URL with optional success and per-provider failures.
 */
export async function performWebFetch(
  searchResults: WebSearchResult[],
  deps: WebFetchDeps,
): Promise<WebFetchOutcome[]> {
  const { config, gotClient = got, logger: logOpt, throttleStats } = deps;
  const log = logOpt ?? defaultLogger;
  const providerConfigs = config.providers;

  log.info(
    {
      urlCount: searchResults.length,
      providerChain: providerConfigs.map((provider) => provider.type),
    },
    "web fetch: starting",
  );

  const chain = buildProviderChain(providerConfigs);
  const concurrency = resolveFetchConcurrency(providerConfigs);
  const sharedDeps = {
    gotClient,
    log,
    hostErrorTracker: deps.hostErrorTracker,
  };

  const results = await pMap(
    searchResults,
    (result) => fetchOneResult(result, chain, sharedDeps),
    { concurrency },
  );

  if (throttleStats) {
    throttleStats.throttleEvents += chain.reduce(
      (total, entry) => total + entry.rateLimiter.getThrottleEvents(),
      0,
    );
  }

  return results;
}

/** @deprecated Use `jinaResponseSchema` from `./fetch-providers/jina` instead. */
export { jinaResponseSchema as webFetchResponseSchema } from "./fetch-providers/jina";
