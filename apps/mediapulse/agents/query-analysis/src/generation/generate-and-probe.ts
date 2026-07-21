import { QUERY_ANALYSIS_INTENTS } from "@workspace/agent-data-api-contract";
import type { ProviderEntry, SearchLocale } from "@workspace/agent-search";
import type { SearchProviderLogger } from "@workspace/agent-search";

import { GENERATION_MAX_ATTEMPTS } from "../constants";
import {
  normalizeQueryText,
  runYieldProbe,
  type ProbedCandidate,
  type ProbeProviderUsage,
  type ProbeSurvivor,
  type YieldProbeDeps,
} from "../probe/yield-probe";
import {
  generateQueryCandidates,
  type GenerateQueryCandidatesInput,
} from "./generate-candidates";

/** Inputs for the generate → probe → retry-on-empty orchestration. */
export type GenerateAndProbeInput = Omit<
  GenerateQueryCandidatesInput,
  "excludeQueries" | "logger"
> & {
  providers: ProviderEntry[];
  locales: SearchLocale[];
  probeBudget: number;
  probeConcurrency: number;
  probeMinResults: number;
  probeTimeoutMs: number;
  /** Per-intent target. Retries continue while any intent is short and attempts remain. */
  queriesPerIntent: number;
  logger?: SearchProviderLogger;
};

/** An intent that has fewer pooled candidates than the per-intent target. */
export type ShortIntent = { intent: string; need: number };

/**
 * Returns every intent still below the per-intent target, with the shortfall.
 *
 * Intents absent from the pool entirely are reported as needing the full target,
 * so an intent the model skipped is retried rather than silently accepted.
 *
 * @param pooled - Candidates eligible for selection (survivors plus dropped).
 * @param queriesPerIntent - Target candidate count for each intent.
 */
export const findShortIntents = (
  pooled: readonly { intent: string }[],
  queriesPerIntent: number,
): ShortIntent[] => {
  const counts = new Map<string, number>();
  for (const intent of QUERY_ANALYSIS_INTENTS) {
    counts.set(intent, 0);
  }
  for (const candidate of pooled) {
    counts.set(candidate.intent, (counts.get(candidate.intent) ?? 0) + 1);
  }

  const short: ShortIntent[] = [];
  for (const [intent, count] of counts) {
    if (count < queriesPerIntent) {
      short.push({ intent, need: queriesPerIntent - count });
    }
  }

  return short;
};

/** Injectable collaborators for {@link generateAndProbeCandidates} (tests only). */
export type GenerateAndProbeDeps = {
  probeDeps?: YieldProbeDeps;
};

/** Aggregated telemetry across every generation/probe attempt. */
export type GenerateAndProbeTelemetry = {
  candidates: number;
  deduped: number;
  dropped: string[];
  survivors: number;
  providerUsage: ProbeProviderUsage[];
  searchCredits: number;
};

/** Result of the full generate → probe → retry loop. */
export type GenerateAndProbeResult = {
  survivors: ProbeSurvivor[];
  dropped: ProbedCandidate[];
  attempts: number;
  telemetry: GenerateAndProbeTelemetry;
};

/**
 * Generates query candidates via LLM, probes them for live search yield, and retries with
 * targeted feedback when an attempt returns zero-hit candidates — bounded by
 * {@link GENERATION_MAX_ATTEMPTS}. Each retry only re-probes the new replacement candidates,
 * not the full accumulated set, to bound search-provider credit spend.
 *
 * - Important: This loop guards against a *different* risk than ambiguous-but-popular queries
 *   (the historical "FORE" bug) — it catches queries that are plausible-sounding but surface
 *   nothing at all, a failure mode only possible once generation is open-ended (LLM-driven)
 *   rather than fixed templates.
 *
 * @param input - Ticker/classification/market/contract context, discovered entities, LLM
 *   credentials, and probe provider/locale/budget config.
 * @param deps - Injectable probe collaborators for tests.
 * @returns Merged survivors/dropped (deduped across attempts), attempt count, and aggregated
 *   telemetry.
 */
export const generateAndProbeCandidates = async (
  input: GenerateAndProbeInput,
  deps: GenerateAndProbeDeps = {},
): Promise<GenerateAndProbeResult> => {
  const survivorsByKey = new Map<string, ProbeSurvivor>();
  const droppedByKey = new Map<string, ProbedCandidate>();
  const providerUsageTotals = new Map<string, number>();
  const allDroppedTexts: string[] = [];

  let candidatesTotal = 0;
  let dedupedTotal = 0;
  let searchCreditsTotal = 0;
  let excludeQueries: string[] = [];
  let shortIntentFeedback: ShortIntent[] = [];
  let attempts = 0;

  for (attempts = 1; attempts <= GENERATION_MAX_ATTEMPTS; attempts++) {
    input.logger?.info(
      {
        tickerSymbol: input.ticker.symbol,
        attempt: attempts,
        maxAttempts: GENERATION_MAX_ATTEMPTS,
        excludeCount: excludeQueries.length,
      },
      "query generation attempt started",
    );

    const candidates = await generateQueryCandidates({
      ...input,
      ...(input.logger ? { logger: input.logger } : {}),
      ...(excludeQueries.length > 0 ? { excludeQueries } : {}),
      ...(shortIntentFeedback.length > 0
        ? { shortIntents: shortIntentFeedback }
        : {}),
    });

    input.logger?.info(
      {
        tickerSymbol: input.ticker.symbol,
        attempt: attempts,
        candidates: candidates.length,
        sample: candidates.slice(0, 5).map((candidate) => candidate.text),
      },
      "query generation attempt produced candidates",
    );

    const probe = await runYieldProbe(
      {
        candidates,
        providers: input.providers,
        locales: input.locales,
        budget: input.probeBudget,
        concurrency: input.probeConcurrency,
        minResults: input.probeMinResults,
        timeoutMs: input.probeTimeoutMs,
        ...(input.logger ? { logger: input.logger } : {}),
      },
      deps.probeDeps ?? {},
    );

    candidatesTotal += probe.telemetry.candidates;
    dedupedTotal += probe.telemetry.deduped;
    searchCreditsTotal += probe.telemetry.searchCredits;
    allDroppedTexts.push(...probe.telemetry.dropped);
    for (const usage of probe.telemetry.providerUsage) {
      providerUsageTotals.set(
        usage.name,
        (providerUsageTotals.get(usage.name) ?? 0) + usage.calls,
      );
    }

    for (const survivor of probe.survivors) {
      const key = normalizeQueryText(survivor.text);
      if (!survivorsByKey.has(key)) {
        survivorsByKey.set(key, survivor);
      }
    }

    const zeroHitTexts: string[] = [];
    for (const candidate of probe.dropped) {
      const key = normalizeQueryText(candidate.text);
      if (!survivorsByKey.has(key) && !droppedByKey.has(key)) {
        droppedByKey.set(key, candidate);
      }
      if (candidate.hits === 0) {
        zeroHitTexts.push(candidate.text);
      }
    }

    // Coverage is measured over survivors AND dropped candidates, because
    // finalize selects from that combined pool: a zero-hit query still fills a
    // slot, it just ranks last.
    const shortIntents = findShortIntents(
      [...survivorsByKey.values(), ...droppedByKey.values()],
      input.queriesPerIntent,
    );

    input.logger?.info(
      {
        tickerSymbol: input.ticker.symbol,
        attempt: attempts,
        probed: probe.telemetry.deduped,
        attemptSurvivors: probe.survivors.length,
        attemptDropped: probe.dropped.length,
        cumulativeSurvivors: survivorsByKey.size,
        queriesPerIntent: input.queriesPerIntent,
        shortIntents: shortIntents.map((entry) => entry.intent),
        searchCredits: probe.telemetry.searchCredits,
      },
      "query probe attempt complete",
    );

    if (shortIntents.length === 0 || attempts >= GENERATION_MAX_ATTEMPTS) {
      break;
    }
    excludeQueries = zeroHitTexts;
    shortIntentFeedback = shortIntents;
  }

  const survivors: ProbeSurvivor[] = [...survivorsByKey.values()]
    .sort((left, right) => right.hits - left.hits)
    .map((candidate, index) => ({ ...candidate, rank: index + 1 }));
  const dropped: ProbedCandidate[] = [...droppedByKey.values()];
  const providerUsage: ProbeProviderUsage[] = [
    ...providerUsageTotals.entries(),
  ].map(([name, calls]) => ({ name, calls }));

  return {
    survivors,
    dropped,
    attempts,
    telemetry: {
      candidates: candidatesTotal,
      deduped: dedupedTotal,
      dropped: allDroppedTexts,
      survivors: survivors.length,
      providerUsage,
      searchCredits: searchCreditsTotal,
    },
  };
};
