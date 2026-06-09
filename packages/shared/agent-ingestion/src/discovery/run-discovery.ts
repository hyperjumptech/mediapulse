import { classifyError, isRetryableError } from "../error-classification";
import { hostFromUrl } from "../host-error-tracker";
import { pMap } from "../p-map";
import { createListingDiscoveryStrategy } from "./registry";
import type { DiscoveredItem, DiscoveryDeps } from "./types";

const DEFAULT_DISCOVERY_CONCURRENCY = 4;

/** A single listing source for discovery. */
export type DiscoverySource = {
  url: string;
  /** Whether to include this source. Defaults to true when omitted. */
  enabled?: boolean;
  /** The single strategy the operator chose for this source. */
  strategy: "rss" | "sitemap" | "generic-links";
  /** Maximum items to return from this source. */
  maxItems?: number;
};

/** A per-strategy failure captured during discovery. */
export type DiscoveryFailure = {
  sourceUrl: string;
  strategyType: string;
  errorCategory: string;
  message: string;
  retryable: boolean;
};

/** Result of running discovery over a single source's strategy chain. */
export type SourceDiscoveryOutcome = {
  items: DiscoveredItem[];
  failures: DiscoveryFailure[];
  winningStrategy: string | null;
};

/** Per-source health snapshot produced by runDiscovery for observability. */
export type SourceDiscoveryReport = {
  listingUrl: string;
  discovered: boolean;
  itemCount: number;
  winningStrategy: string | null;
  failureCount: number;
  lastError: string | null;
};

/** Aggregate result of running discovery over all sources. */
export type RunDiscoveryResult = {
  items: DiscoveredItem[];
  failures: DiscoveryFailure[];
  sourceReports: SourceDiscoveryReport[];
};

/** Optional cache port for cross-ticker listing discovery deduplication. */
export type DiscoveryCache = {
  lookup: (
    listingUrls: string[],
  ) => Promise<Array<{ listingUrl: string; items: DiscoveredItem[] }>>;
  record: (
    entries: Array<{
      listingUrl: string;
      strategy: string;
      items: DiscoveredItem[];
      ttlSeconds: number;
    }>,
  ) => Promise<void>;
  ttlSeconds: number;
};

/**
 * Runs a source through the single operator-chosen strategy.
 *
 * An error or empty result yields `{ items: [], failures }`. Failure shape is
 * unchanged so observability and SourceDiscoveryReport are untouched.
 *
 * @param source - Listing source configuration.
 * @param deps - Shared discovery dependencies.
 */
export const discoverOneSource = async (
  source: DiscoverySource,
  deps: DiscoveryDeps,
): Promise<SourceDiscoveryOutcome> => {
  const strategyType = source.strategy;
  const strategy = createListingDiscoveryStrategy(strategyType);

  try {
    const items = await strategy.discover(source.url, deps);

    if (items.length === 0) {
      return {
        items: [],
        failures: [
          {
            sourceUrl: source.url,
            strategyType,
            errorCategory: "provider_data_invalid",
            message: "Strategy returned no items",
            retryable: false,
          },
        ],
        winningStrategy: null,
      };
    }

    const limited =
      source.maxItems !== undefined ? items.slice(0, source.maxItems) : items;

    return { items: limited, failures: [], winningStrategy: strategyType };
  } catch (error) {
    const classified = classifyError(error);
    return {
      items: [],
      failures: [
        {
          sourceUrl: source.url,
          strategyType,
          errorCategory: classified.category,
          message: classified.message,
          retryable: isRetryableError(error),
        },
      ],
      winningStrategy: null,
    };
  }
};

/**
 * Runs discovery over all enabled sources, deduplicates by canonical URL, and returns
 * the merged item list with all per-strategy failures captured (never thrown).
 *
 * When a cache port is provided, each source is checked for a fresh cache hit before
 * live scraping. On a miss, the source is scraped and fresh results are written back.
 * Empty results are never cached. Without a cache port, behavior is identical to Plan 95.
 *
 * @param sources - Listing sources to discover from.
 * @param deps - Shared discovery dependencies.
 * @param cache - Optional cross-ticker discovery cache port.
 */
export const runDiscovery = async (
  sources: DiscoverySource[],
  deps: DiscoveryDeps,
  cache?: DiscoveryCache,
): Promise<RunDiscoveryResult> => {
  const enabledSources = sources.filter((source) => source.enabled !== false);
  const concurrency = deps.concurrency ?? DEFAULT_DISCOVERY_CONCURRENCY;

  const allItems: DiscoveredItem[] = [];
  const allFailures: DiscoveryFailure[] = [];
  const allSourceReports: SourceDiscoveryReport[] = [];
  const seen = new Set<string>();

  const tryDiscover = async (
    source: DiscoverySource,
  ): Promise<SourceDiscoveryOutcome> => {
    const host = hostFromUrl(source.url);
    if (deps.hostErrorTracker?.isSkipped(host)) {
      return {
        items: [],
        failures: [
          {
            sourceUrl: source.url,
            strategyType: "host-breaker",
            errorCategory: "provider_http_error",
            message: `Host ${host} is over the error-rate threshold; skipped in discovery`,
            retryable: false,
          },
        ],
        winningStrategy: null,
      };
    }
    const outcome = await discoverOneSource(source, deps);
    deps.hostErrorTracker?.record(host, outcome.items.length > 0);

    return outcome;
  };

  const addItems = (items: DiscoveredItem[]) => {
    for (const item of items) {
      if (!seen.has(item.url)) {
        seen.add(item.url);
        allItems.push(item);
      }
    }
  };

  const buildReport = (
    listingUrl: string,
    outcome: SourceDiscoveryOutcome,
  ): SourceDiscoveryReport => {
    const lastFailure = outcome.failures[outcome.failures.length - 1];

    return {
      listingUrl,
      discovered: outcome.items.length > 0,
      itemCount: outcome.items.length,
      winningStrategy: outcome.winningStrategy,
      failureCount: outcome.failures.length,
      lastError: lastFailure?.message ?? null,
    };
  };

  if (cache && enabledSources.length > 0) {
    const sourceUrls = enabledSources.map((source) => source.url);
    const cacheHits = await cache.lookup(sourceUrls);
    const hitMap = new Map(
      cacheHits.map((entry) => [entry.listingUrl, entry.items]),
    );

    const missedSources = enabledSources.filter(
      (source) => !hitMap.has(source.url),
    );

    for (const [listingUrl, cachedItems] of hitMap) {
      addItems(cachedItems);
      allSourceReports.push({
        listingUrl,
        discovered: cachedItems.length > 0,
        itemCount: cachedItems.length,
        winningStrategy: "cache",
        failureCount: 0,
        lastError: null,
      });
    }

    if (missedSources.length > 0) {
      const missOutcomes = await pMap(missedSources, tryDiscover, {
        concurrency,
      });

      const freshEntries: Array<{
        listingUrl: string;
        strategy: string;
        items: DiscoveredItem[];
        ttlSeconds: number;
      }> = [];

      for (let index = 0; index < missedSources.length; index += 1) {
        const source = missedSources[index]!;
        const outcome = missOutcomes[index]!;
        allFailures.push(...outcome.failures);
        addItems(outcome.items);
        allSourceReports.push(buildReport(source.url, outcome));

        if (outcome.items.length > 0) {
          freshEntries.push({
            listingUrl: source.url,
            strategy: outcome.winningStrategy ?? "rss",
            items: outcome.items,
            ttlSeconds: cache.ttlSeconds,
          });
        }
      }

      if (freshEntries.length > 0) {
        await cache.record(freshEntries);
      }
    }

    return {
      items: allItems,
      failures: allFailures,
      sourceReports: allSourceReports,
    };
  }

  const outcomes = await pMap(enabledSources, tryDiscover, { concurrency });
  for (let index = 0; index < enabledSources.length; index += 1) {
    const source = enabledSources[index]!;
    const outcome = outcomes[index]!;
    allFailures.push(...outcome.failures);
    addItems(outcome.items);
    allSourceReports.push(buildReport(source.url, outcome));
  }

  return {
    items: allItems,
    failures: allFailures,
    sourceReports: allSourceReports,
  };
};
