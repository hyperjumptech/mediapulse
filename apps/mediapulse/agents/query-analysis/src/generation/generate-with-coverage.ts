import { QUERY_ANALYSIS_INTENTS } from "@workspace/agent-data-api-contract";
import type { SearchProviderLogger } from "@workspace/agent-search";

import { GENERATION_MAX_ATTEMPTS } from "../constants";
import { dedupeCandidates, normalizeQueryText } from "../pipeline/candidates";
import type { Candidate } from "../pipeline/types";
import {
  generateQueryCandidates,
  type GenerateQueryCandidatesInput,
} from "./generate-candidates";

/** Inputs for the generate → retry-on-short-coverage orchestration. */
export type GenerateWithCoverageInput = Omit<
  GenerateQueryCandidatesInput,
  "excludeQueries" | "shortIntents" | "logger"
> & {
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
 * @param pooled - Candidates gathered so far.
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

/** Aggregated telemetry across every generation attempt. */
export type GenerateWithCoverageTelemetry = {
  candidates: number;
  deduped: number;
};

/** Result of the full generate → retry loop. */
export type GenerateWithCoverageResult = {
  candidates: Candidate[];
  attempts: number;
  telemetry: GenerateWithCoverageTelemetry;
};

/**
 * Generates query candidates via LLM and retries with targeted feedback when an intent comes
 * back short of its per-intent target — bounded by {@link GENERATION_MAX_ATTEMPTS}. Retries are
 * LLM-only and consume no search credits.
 *
 * @param input - Ticker/classification/market/contract context, discovered entities, LLM
 *   credentials, and the per-intent target.
 * @returns Deduped candidates (merged across attempts), attempt count, and aggregated telemetry.
 */
export const generateCandidatesWithCoverage = async (
  input: GenerateWithCoverageInput,
): Promise<GenerateWithCoverageResult> => {
  const candidatesByKey = new Map<string, Candidate>();

  let candidatesTotal = 0;
  let shortIntentFeedback: ShortIntent[] = [];
  let attempts = 0;

  for (attempts = 1; attempts <= GENERATION_MAX_ATTEMPTS; attempts++) {
    input.logger?.info(
      {
        tickerSymbol: input.ticker.symbol,
        attempt: attempts,
        maxAttempts: GENERATION_MAX_ATTEMPTS,
        shortIntents: shortIntentFeedback.map((entry) => entry.intent),
      },
      "query generation attempt started",
    );

    const generated = await generateQueryCandidates({
      ...input,
      ...(input.logger ? { logger: input.logger } : {}),
      ...(shortIntentFeedback.length > 0
        ? { shortIntents: shortIntentFeedback }
        : {}),
    });

    candidatesTotal += generated.length;
    for (const candidate of dedupeCandidates(generated)) {
      const key = normalizeQueryText(candidate.text);
      if (!candidatesByKey.has(key)) {
        candidatesByKey.set(key, candidate);
      }
    }

    const pooled = [...candidatesByKey.values()];
    const shortIntents = findShortIntents(pooled, input.queriesPerIntent);

    input.logger?.info(
      {
        tickerSymbol: input.ticker.symbol,
        attempt: attempts,
        generated: generated.length,
        cumulativeCandidates: candidatesByKey.size,
        queriesPerIntent: input.queriesPerIntent,
        shortIntents: shortIntents.map((entry) => entry.intent),
      },
      "query generation attempt complete",
    );

    if (shortIntents.length === 0 || attempts >= GENERATION_MAX_ATTEMPTS) {
      break;
    }
    shortIntentFeedback = shortIntents;
  }

  const candidates = [...candidatesByKey.values()];

  return {
    candidates,
    attempts,
    telemetry: {
      candidates: candidatesTotal,
      deduped: candidates.length,
    },
  };
};
