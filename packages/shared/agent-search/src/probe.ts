import got from "got";

import {
  AllProvidersFailed,
  dispatch,
  type DispatchProvider,
  type RoundRobinCursor,
} from "./dispatch";
import type { SearchLocale } from "./schemas";
import type {
  SearchHit,
  SearchProvider,
  SearchProviderLogger,
  SearchProviderResult,
} from "./types";

/** Default per-request timeout for a probe search. */
const DEFAULT_PROBE_TIMEOUT_MS = 15_000;

const noopLogger: SearchProviderLogger = {
  info: () => undefined,
  warn: () => undefined,
};

/** Sink that accumulates provider-reported search credits across probe calls. */
export interface CreditsSink {
  credits: number;
}

/** Inputs for a single-query yield probe. */
export interface CountQueryHitsContext {
  /** Instantiated search provider pool (round-robin + failover). */
  providers: SearchProvider[];
  /** Locales to probe; the query is searched once per locale. */
  locales: SearchLocale[];
  /** Shared rotating cursor; advanced once per locale dispatch. */
  cursor: RoundRobinCursor;
  gotClient?: typeof got;
  timeoutMs?: number;
  logger?: SearchProviderLogger;
  /** Optional external accumulator for total credits spent (Chronicle telemetry). */
  creditsSink?: CreditsSink;
}

/** Result of a single-query yield probe. */
export interface CountQueryHitsResult {
  /** Maximum hit count observed across the probed locales. */
  hits: number;
  /** Total provider-reported credits consumed by this probe. */
  credits: number;
  /** Provider type that produced the best (max-hit) result, if any. */
  provider?: string;
  /** True when every probed locale failed to reach a provider, so `hits` is unknown rather than a genuine zero. */
  failed?: boolean;
}

/**
 * Probes a single query against the search provider pool and reports whether it yields results.
 *
 * - Searches once per locale (round-robin + failover across `providers`), keeping the max hit count.
 * - Accumulates provider-reported credits for every provider call that returned, into the result and `creditsSink`.
 * - Treats a fully failed pool (`AllProvidersFailed`) for a locale as zero hits.
 *
 * @param queryText - The candidate query to probe.
 * @param context - Providers, locales, cursor, and optional client/logging/credits sink.
 * @returns Max hits across locales, total credits, and the best provider.
 */
export async function countQueryHits(
  queryText: string,
  context: CountQueryHitsContext,
): Promise<CountQueryHitsResult> {
  const gotClient = context.gotClient ?? got;
  const timeoutMs = context.timeoutMs ?? DEFAULT_PROBE_TIMEOUT_MS;
  const logger = context.logger ?? noopLogger;

  let totalCredits = 0;
  const trackCredits = (result: SearchProviderResult): SearchProviderResult => {
    if (typeof result.credits === "number") {
      totalCredits += result.credits;
      if (context.creditsSink) {
        context.creditsSink.credits += result.credits;
      }
    }

    return result;
  };

  const probeLocale = async (
    locale: SearchLocale,
  ): Promise<{ hits: number; provider?: string; ok: boolean }> => {
    const dispatchProviders: DispatchProvider<{
      provider: string;
      result: SearchProviderResult;
    }>[] = context.providers.map((provider) => ({
      name: provider.type,
      run: async () => {
        const result = trackCredits(
          await provider.search(queryText, {
            gotClient,
            locale,
            page: 0,
            timeoutMs,
            logger,
          }),
        );

        return { provider: provider.type, result };
      },
    }));

    try {
      const accepted = await dispatch(
        "search-probe",
        dispatchProviders,
        (candidate) => candidate.result.hits.length > 0,
        context.cursor,
      );

      return {
        hits: accepted.result.hits.length,
        provider: accepted.provider,
        ok: true,
      };
    } catch (error) {
      if (error instanceof AllProvidersFailed) {
        return { hits: 0, ok: false };
      }

      throw error;
    }
  };

  const localeResults = await Promise.all(context.locales.map(probeLocale));

  let maxHits = 0;
  let bestProvider: string | undefined;
  for (const localeResult of localeResults) {
    if (localeResult.hits > maxHits) {
      maxHits = localeResult.hits;
      bestProvider = localeResult.provider;
    }
  }
  const failed =
    localeResults.length > 0 &&
    localeResults.every((localeResult) => !localeResult.ok);

  return {
    hits: maxHits,
    credits: totalCredits,
    ...(bestProvider ? { provider: bestProvider } : {}),
    ...(failed ? { failed: true } : {}),
  };
}

/** Inputs for a single-query result fetch (used by recon, not the yield probe). */
export interface SearchTopResultsContext {
  /** Instantiated search provider pool (round-robin + failover). */
  providers: SearchProvider[];
  /** Single locale to search in. */
  locale: SearchLocale;
  /** Shared rotating cursor; advanced once per dispatch. */
  cursor: RoundRobinCursor;
  gotClient?: typeof got;
  timeoutMs?: number;
  logger?: SearchProviderLogger;
  /** Max results to return; defaults to all hits from the accepted provider. */
  limit?: number;
}

/**
 * Fetches the top search results (titles, urls, snippets) for one query from the first
 * provider in the pool that returns any, with round-robin + failover.
 *
 * @param queryText - The query to search.
 * @param context - Providers, locale, cursor, and optional client/logging/limit.
 * @returns The accepted provider's hits (capped to `limit`), or `[]` when the whole pool fails.
 */
export async function searchTopResults(
  queryText: string,
  context: SearchTopResultsContext,
): Promise<SearchHit[]> {
  const gotClient = context.gotClient ?? got;
  const timeoutMs = context.timeoutMs ?? DEFAULT_PROBE_TIMEOUT_MS;
  const logger = context.logger ?? noopLogger;

  const dispatchProviders: DispatchProvider<{
    provider: string;
    result: SearchProviderResult;
  }>[] = context.providers.map((provider) => ({
    name: provider.type,
    run: async () => {
      const result = await provider.search(queryText, {
        gotClient,
        locale: context.locale,
        page: 0,
        timeoutMs,
        logger,
      });

      return { provider: provider.type, result };
    },
  }));

  try {
    const accepted = await dispatch(
      "search-recon",
      dispatchProviders,
      (candidate) => candidate.result.hits.length > 0,
      context.cursor,
    );
    const limit = context.limit ?? accepted.result.hits.length;

    return accepted.result.hits.slice(0, limit);
  } catch (error) {
    if (error instanceof AllProvidersFailed) {
      return [];
    }

    throw error;
  }
}
