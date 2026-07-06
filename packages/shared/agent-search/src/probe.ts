import got from "got";

import {
  AllProvidersFailed,
  dispatch,
  type DispatchProvider,
  type RoundRobinCursor,
} from "./dispatch";
import type { SearchLocale } from "./schemas";
import type {
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

  let maxHits = 0;
  let bestProvider: string | undefined;

  for (const locale of context.locales) {
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
      const hits = accepted.result.hits.length;
      if (hits > maxHits) {
        maxHits = hits;
        bestProvider = accepted.provider;
      }
    } catch (error) {
      if (error instanceof AllProvidersFailed) {
        continue;
      }

      throw error;
    }
  }

  return {
    hits: maxHits,
    credits: totalCredits,
    ...(bestProvider ? { provider: bestProvider } : {}),
  };
}
