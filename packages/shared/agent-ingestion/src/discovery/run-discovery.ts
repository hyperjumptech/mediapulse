import { classifyError, isRetryableError } from "../error-classification";
import {
  createListingDiscoveryStrategy,
  DEFAULT_DISCOVERY_CHAIN,
} from "./registry";
import type { DiscoveredItem, DiscoveryDeps } from "./types";

/** A single listing source for discovery. */
export type DiscoverySource = {
  url: string;
  /** Whether to include this source. Defaults to true when omitted. */
  enabled?: boolean;
  /** Ordered strategy chain override; falls back to DEFAULT_DISCOVERY_CHAIN. */
  strategies?: ReadonlyArray<"rss" | "sitemap" | "generic-links">;
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
};

/** Aggregate result of running discovery over all sources. */
export type RunDiscoveryResult = {
  items: DiscoveredItem[];
  failures: DiscoveryFailure[];
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
 * Runs a source through its ordered strategy chain with fallback.
 *
 * The first strategy that returns a non-empty list wins. An error or empty
 * result falls through to the next strategy. Every per-strategy failure is
 * collected; the source yields `{ items: [], failures }` only when the whole
 * chain is exhausted — mirroring fetchOneResult's loop over the provider chain.
 *
 * @param source - Listing source configuration.
 * @param deps - Shared discovery dependencies.
 */
export const discoverOneSource = async (
  source: DiscoverySource,
  deps: DiscoveryDeps,
): Promise<SourceDiscoveryOutcome> => {
  const chain = source.strategies ?? DEFAULT_DISCOVERY_CHAIN;
  const failures: DiscoveryFailure[] = [];

  for (const strategyType of chain) {
    const strategy = createListingDiscoveryStrategy(strategyType);

    try {
      const items = await strategy.discover(source.url, deps);

      if (items.length === 0) {
        failures.push({
          sourceUrl: source.url,
          strategyType,
          errorCategory: "provider_data_invalid",
          message: "Strategy returned no items",
          retryable: false,
        });
        continue;
      }

      const limited =
        source.maxItems !== undefined ? items.slice(0, source.maxItems) : items;

      return { items: limited, failures };
    } catch (error) {
      const classified = classifyError(error);
      failures.push({
        sourceUrl: source.url,
        strategyType,
        errorCategory: classified.category,
        message: classified.message,
        retryable: isRetryableError(error),
      });
    }
  }

  return { items: [], failures };
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

  const allItems: DiscoveredItem[] = [];
  const allFailures: DiscoveryFailure[] = [];
  const seen = new Set<string>();

  if (cache && enabledSources.length > 0) {
    const sourceUrls = enabledSources.map((source) => source.url);
    const cacheHits = await cache.lookup(sourceUrls);
    const hitMap = new Map(
      cacheHits.map((entry) => [entry.listingUrl, entry.items]),
    );

    const freshEntries: Array<{
      listingUrl: string;
      strategy: string;
      items: DiscoveredItem[];
      ttlSeconds: number;
    }> = [];

    for (const source of enabledSources) {
      const cached = hitMap.get(source.url);
      if (cached !== undefined) {
        for (const item of cached) {
          if (!seen.has(item.url)) {
            seen.add(item.url);
            allItems.push(item);
          }
        }
        continue;
      }

      const { items, failures } = await discoverOneSource(source, deps);
      allFailures.push(...failures);

      for (const item of items) {
        if (!seen.has(item.url)) {
          seen.add(item.url);
          allItems.push(item);
        }
      }

      if (items.length > 0) {
        const winningStrategy =
          source.strategies?.[0] ?? DEFAULT_DISCOVERY_CHAIN[0] ?? "rss";
        freshEntries.push({
          listingUrl: source.url,
          strategy: winningStrategy,
          items,
          ttlSeconds: cache.ttlSeconds,
        });
      }
    }

    if (freshEntries.length > 0) {
      await cache.record(freshEntries);
    }

    return { items: allItems, failures: allFailures };
  }

  for (const source of enabledSources) {
    const { items, failures } = await discoverOneSource(source, deps);

    for (const item of items) {
      if (!seen.has(item.url)) {
        seen.add(item.url);
        allItems.push(item);
      }
    }
    allFailures.push(...failures);
  }

  return { items: allItems, failures: allFailures };
};
