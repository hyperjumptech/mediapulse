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

import type { DataCollectionFailure } from "@workspace/agent-data-api-contract";
import type { FetchMetadata } from "./date-extractor";
import { HostErrorTracker, hostFromUrl } from "./host-error-tracker";

/** Search result produced by the search stage and consumed by the fetch stage. */
export interface WebSearchResult {
  url: string;
  title: string;
  content: string;
  author?: string;
  source?: string;
  tickerId: string;
  searchQueryId: string;
  searchQueryText: string;
  serpIndex: number;
  /** Optional fetch provider metadata captured during web fetch. */
  fetchMetadata?: FetchMetadata;
  /** @deprecated Use {@link WebSearchResult.fetchMetadata} instead. */
  jinaMetadata?: FetchMetadata;
}

export type WebFetchProviderName = Extract<
  DataCollectionFailure["provider"],
  | "serper"
  | "jina"
  | "firecrawl"
  | "firecrawl_selfhosted"
  | "diffbot"
  | "tavily"
  | "exa"
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
  config: { providers: FetchProviderConfig[] };
  gotClient?: typeof got;
  /** Logger with run correlation; defaults to workspace logger. */
  logger?: WebFetchLogger;
  /** Optional counter mutated with adaptive throttle events for this stage. */
  throttleStats?: StageThrottleStats;
  /** Optional per-run host error tracker updated on every fetch attempt. */
  hostErrorTracker?: HostErrorTracker;
  /**
   * Optional hook invoked with each fetch outcome the moment it resolves, before the
   * rest of the batch finishes. Lets callers stream per-URL side effects (for example,
   * persisting a successful page immediately) instead of waiting for every fetch in the
   * batch to complete. Awaited within the fetch concurrency slot, so a rejecting hook
   * aborts the batch the same way a failing fetch would.
   */
  onOutcome?: (outcome: WebFetchOutcome) => void | Promise<void>;
  /**
   * Optional absolute wall-clock deadline (epoch ms). Once reached, URLs not yet
   * started are skipped instead of fetched so a slow batch cannot wedge the run.
   */
  deadlineEpochMs?: number;
}

/**
 * Extra time beyond a provider's request timeout before the hard per-attempt abort
 * fires. Covers rate-limiter wait plus response parsing so the provider's own timeout
 * (which yields a clean classified error) trips first and the abort is only a backstop.
 */
const ATTEMPT_ABORT_BUFFER_MS = 5_000;

/** Fallback hard per-attempt ceiling when a provider config omits `timeoutMs`. */
const DEFAULT_HARD_ATTEMPT_TIMEOUT_MS = 60_000;

/**
 * Races a provider fetch against a hard deadline. On timeout it aborts the request
 * (cancelling the in-flight HTTP call) and rejects, so the chain advances even if a
 * provider ignores the abort signal. The losing promise is always handled, avoiding
 * unhandled rejections when it settles late.
 *
 * @param fetchPromise - In-flight provider fetch.
 * @param timeoutMs - Hard ceiling before the attempt is abandoned.
 * @param controller - Abort controller wired into the provider request.
 */
const fetchWithHardTimeout = <T>(
  fetchPromise: Promise<T>,
  timeoutMs: number,
  controller: AbortController,
): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      controller.abort();
      reject(
        new Error(`web fetch attempt exceeded hard timeout of ${timeoutMs}ms`),
      );
    }, timeoutMs);
    fetchPromise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error as Error);
      },
    );
  });

type ProviderChainEntry = {
  provider: FetchProvider;
  config: FetchProviderConfig;
  rateLimiter: RateLimiter;
};

const WEB_FETCH_PROVIDER_NAMES = new Set<WebFetchProviderName>([
  "serper",
  "jina",
  "firecrawl",
  "firecrawl_selfhosted",
  "diffbot",
  "tavily",
  "exa",
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
 * Fetches one search hit through the provider pool with round-robin + failover.
 *
 * @param result - Search hit to fetch.
 * @param chain - Provider adapters with per-provider rate limiters.
 * @param startOffset - Rotating start index so each URL begins at a different provider.
 * @param deps - Shared dependencies for the fetch stage.
 */
const fetchOneResult = async (
  result: WebSearchResult,
  chain: ProviderChainEntry[],
  startOffset: number,
  deps: {
    gotClient: typeof got;
    log: WebFetchLogger;
    hostErrorTracker?: HostErrorTracker;
  },
): Promise<WebFetchOutcome> => {
  const { gotClient, log, hostErrorTracker } = deps;
  const failures: WebFetchFailure[] = [];

  const rotated = chain.map(
    (_, index) => chain[(startOffset + index) % chain.length]!,
  );

  for (const entry of rotated) {
    const providerName = toWebFetchProviderName(entry.provider.type);
    const hardTimeoutMs =
      (entry.config.timeoutMs ?? DEFAULT_HARD_ATTEMPT_TIMEOUT_MS) +
      ATTEMPT_ABORT_BUFFER_MS;
    const abortController = new AbortController();

    try {
      const data = await fetchWithHardTimeout(
        entry.provider.fetchOne(result.url, {
          gotClient,
          rateLimiter: entry.rateLimiter,
          logger: log,
          signal: abortController.signal,
        }),
        hardTimeoutMs,
        abortController,
      );

      hostErrorTracker?.record(hostFromUrl(result.url), true);

      const fetchMetadata = buildFetchMetadata(data);

      return {
        success: {
          url: data.url ?? result.url,
          title: data.title ?? result.title,
          content: data.content,
          ...(data.author ? { author: data.author } : {}),
          ...(data.source ? { source: data.source } : {}),
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
  const {
    config,
    gotClient = got,
    logger: logOpt,
    throttleStats,
    onOutcome,
    deadlineEpochMs,
  } = deps;
  const log = logOpt ?? defaultLogger;
  const providerConfigs = config.providers;
  const deadline = deadlineEpochMs ?? Infinity;
  let skippedAfterDeadline = 0;

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

  // Rotate the starting provider per URL so load spreads across the pool
  // instead of always hitting the first provider.
  let dispatchIndex = 0;

  const results = await pMap(
    searchResults,
    async (result) => {
      const startOffset = dispatchIndex;
      dispatchIndex += 1;
      // Once the wall-clock deadline passes, stop starting new fetches so one
      // slow batch cannot wedge the run. Remaining URLs resolve as unfetched.
      if (Date.now() >= deadline) {
        skippedAfterDeadline += 1;
        return { success: null, failures: [] } satisfies WebFetchOutcome;
      }
      const outcome = await fetchOneResult(
        result,
        chain,
        startOffset,
        sharedDeps,
      );
      if (onOutcome) {
        await onOutcome(outcome);
      }
      return outcome;
    },
    { concurrency },
  );

  if (skippedAfterDeadline > 0) {
    log.warn(
      {
        skippedAfterDeadline,
        urlCount: searchResults.length,
      },
      "web fetch: wall-clock deadline reached, skipped remaining URLs",
    );
  }

  if (throttleStats) {
    throttleStats.throttleEvents += chain.reduce(
      (total, entry) => total + entry.rateLimiter.getThrottleEvents(),
      0,
    );
  }

  return results;
}
