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
  logger?: SearchProviderLogger;
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
  usedFallback: boolean;
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
 * @returns Merged survivors/dropped (deduped across attempts), fallback flag, attempt count,
 *   and aggregated telemetry.
 */
export const generateAndProbeCandidates = async (
  input: GenerateAndProbeInput,
  deps: GenerateAndProbeDeps = {},
): Promise<GenerateAndProbeResult> => {
  const survivorsByKey = new Map<string, ProbeSurvivor>();
  const droppedByKey = new Map<string, ProbedCandidate>();
  const providerUsageTotals = new Map<string, number>();
  const allDroppedTexts: string[] = [];

  let usedFallback = false;
  let candidatesTotal = 0;
  let dedupedTotal = 0;
  let searchCreditsTotal = 0;
  let excludeQueries: string[] = [];
  let attempts = 0;

  for (attempts = 1; attempts <= GENERATION_MAX_ATTEMPTS; attempts++) {
    const generation = await generateQueryCandidates({
      ...input,
      ...(input.logger ? { logger: input.logger } : {}),
      ...(excludeQueries.length > 0 ? { excludeQueries } : {}),
    });
    usedFallback = usedFallback || generation.usedFallback;

    const probe = await runYieldProbe(
      {
        candidates: generation.candidates,
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

    if (zeroHitTexts.length === 0 || attempts >= GENERATION_MAX_ATTEMPTS) {
      break;
    }
    excludeQueries = zeroHitTexts;
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
    usedFallback,
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
