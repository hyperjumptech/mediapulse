import {
  countQueryHits,
  createSearchProvider,
  RoundRobinCursor,
  type CountQueryHitsContext,
  type CountQueryHitsResult,
  type ProviderEntry,
  type SearchLocale,
  type SearchProvider,
} from "@workspace/agent-search";
import type { QueryAnalysisIntent } from "@workspace/agent-data-api-contract";

import type { Candidate } from "../pipeline/types";

/** A probed candidate that met the minimum-yield bar, ranked by hits. */
export type ProbeSurvivor = Candidate & { hits: number; rank: number };

/** A probed candidate that fell below the minimum-yield bar. */
export type ProbedCandidate = Candidate & { hits: number };

/** Per-provider probe call accounting for the Chronicle. */
export type ProbeProviderUsage = { name: string; calls: number };

/** Observability counters for one probe pass. */
export type ProbeTelemetry = {
  candidates: number;
  deduped: number;
  dropped: string[];
  survivors: number;
  providerUsage: ProbeProviderUsage[];
  searchCredits: number;
};

/** Result of one yield probe: ranked survivors, dropped candidates, and telemetry. */
export type YieldProbeResult = {
  survivors: ProbeSurvivor[];
  dropped: ProbedCandidate[];
  telemetry: ProbeTelemetry;
};

/** Collaborators injected for testing. */
export type YieldProbeDeps = {
  countHits?: typeof countQueryHits;
  createProvider?: typeof createSearchProvider;
};

/** Inputs for one yield probe. */
export type YieldProbeInput = {
  candidates: Candidate[];
  providers: ProviderEntry[];
  locales: SearchLocale[];
  budget: number;
  concurrency: number;
  minResults: number;
  timeoutMs: number;
  logger?: CountQueryHitsContext["logger"];
};

/** Normalizes a query text for dedupe (lowercase, collapse whitespace). */
export const normalizeQueryText = (text: string): string =>
  text.trim().toLowerCase().replace(/\s+/g, " ");

/**
 * Stage priority for budget capping. Lower is higher priority:
 * own-company deals (0) > competitor (1) > regulator (2) > industry (3) > disruption (4).
 */
export const stagePriorityForIntent = (intent: QueryAnalysisIntent): number => {
  switch (intent) {
    case "dealsAndMovements":
      return 0;
    case "competitiveLandscape":
      return 1;
    case "regulatoryPolicyWatch":
      return 2;
    case "industryPulse":
      return 3;
    case "disruptorsOrTech":
      return 4;
  }
};

/** Dedupes candidates by normalized text, keeping the first occurrence. */
export const dedupeCandidates = (candidates: Candidate[]): Candidate[] => {
  const seen = new Set<string>();
  const deduped: Candidate[] = [];
  for (const candidate of candidates) {
    const key = normalizeQueryText(candidate.text);
    if (key.length === 0 || seen.has(key)) {
      continue;
    }
    seen.add(key);
    deduped.push(candidate);
  }

  return deduped;
};

/**
 * Caps candidates to `budget` by taking one candidate per intent in rotation, visiting intents
 * in stage-priority order. Every intent keeps a fair share of the probe budget, so a single
 * over-generated intent cannot starve another of the candidates it needs to fill its slots.
 */
export const capToBudget = (
  candidates: Candidate[],
  budget: number,
): Candidate[] => {
  const byIntent = new Map<QueryAnalysisIntent, Candidate[]>();
  for (const candidate of candidates) {
    const list = byIntent.get(candidate.intent) ?? [];
    list.push(candidate);
    byIntent.set(candidate.intent, list);
  }

  const queues = [...byIntent.entries()]
    .sort(
      ([leftIntent], [rightIntent]) =>
        stagePriorityForIntent(leftIntent) -
        stagePriorityForIntent(rightIntent),
    )
    .map(([, list]) => list);

  const capped: Candidate[] = [];
  for (let round = 0; capped.length < budget; round += 1) {
    let tookAny = false;
    for (const queue of queues) {
      const candidate = queue[round];
      if (candidate === undefined) {
        continue;
      }
      tookAny = true;
      capped.push(candidate);
      if (capped.length >= budget) {
        break;
      }
    }
    if (!tookAny) {
      break;
    }
  }

  return capped;
};

/** Runs an async worker over items with bounded concurrency, preserving order. */
const mapWithConcurrency = async <TItem, TResult>(
  items: TItem[],
  concurrency: number,
  worker: (item: TItem, index: number) => Promise<TResult>,
): Promise<TResult[]> => {
  const results = new Array<TResult>(items.length);
  let nextIndex = 0;
  const runners = Array.from(
    { length: Math.max(1, Math.min(concurrency, items.length)) },
    async () => {
      for (;;) {
        const currentIndex = nextIndex;
        nextIndex += 1;
        if (currentIndex >= items.length) {
          return;
        }
        const item = items[currentIndex];
        if (item === undefined) {
          return;
        }
        results[currentIndex] = await worker(item, currentIndex);
      }
    },
  );
  await Promise.all(runners);

  return results;
};

/**
 * Wraps search providers to count per-provider probe calls for the Chronicle.
 *
 * @param entries - Provider config entries.
 * @param createProvider - Factory for a provider adapter.
 * @returns The providers and a live per-provider call-count map.
 */
const buildCountingProviders = (
  entries: ProviderEntry[],
  createProvider: typeof createSearchProvider,
): { providers: SearchProvider[]; callCounts: Map<string, number> } => {
  const callCounts = new Map<string, number>();
  const providers = entries.map((entry) => {
    const base = createProvider(entry);
    const wrapped: SearchProvider = {
      type: base.type,
      search: (queryText, context) => {
        callCounts.set(base.type, (callCounts.get(base.type) ?? 0) + 1);

        return base.search(queryText, context);
      },
    };

    return wrapped;
  });

  return { providers, callCounts };
};

/**
 * Probes each candidate query against the search provider pool, drops zero-yield
 * candidates, and ranks survivors by hit count.
 *
 * @param input - Candidates, provider pool, locales, and probe budget/concurrency.
 * @param deps - Injectable probe/provider collaborators for tests.
 * @returns Ranked survivors, dropped candidates, and probe telemetry.
 */
export const runYieldProbe = async (
  input: YieldProbeInput,
  deps: YieldProbeDeps = {},
): Promise<YieldProbeResult> => {
  const countHits = deps.countHits ?? countQueryHits;
  const createProvider = deps.createProvider ?? createSearchProvider;

  const deduped = dedupeCandidates(input.candidates);
  const probed = capToBudget(deduped, input.budget);

  const { providers, callCounts } = buildCountingProviders(
    input.providers,
    createProvider,
  );
  const cursor = new RoundRobinCursor();
  const creditsSink = { credits: 0 };

  const probeContext: CountQueryHitsContext = {
    providers,
    locales: input.locales,
    cursor,
    timeoutMs: input.timeoutMs,
    creditsSink,
    ...(input.logger ? { logger: input.logger } : {}),
  };

  input.logger?.info(
    {
      candidates: probed.length,
      providers: input.providers.map((entry) => entry.provider),
      locales: input.locales.length,
      timeoutMs: input.timeoutMs,
      concurrency: input.concurrency,
    },
    "yield probe started",
  );

  const candidateDeadlineMs = input.timeoutMs * (input.providers.length + 1);
  const probeCandidate = (
    candidate: Candidate,
  ): Promise<CountQueryHitsResult & { deadlineHit?: boolean }> => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const deadline = new Promise<
      CountQueryHitsResult & { deadlineHit: boolean }
    >((resolve) => {
      timer = setTimeout(
        () => resolve({ hits: 0, credits: 0, failed: true, deadlineHit: true }),
        candidateDeadlineMs,
      );
    });

    return Promise.race([
      countHits(candidate.text, probeContext),
      deadline,
    ]).then((result) => {
      if (timer !== undefined) {
        clearTimeout(timer);
      }

      return result;
    });
  };

  let completed = 0;
  const results = await mapWithConcurrency(
    probed,
    input.concurrency,
    async (candidate): Promise<CountQueryHitsResult> => {
      const startedAt = Date.now();
      const result = await probeCandidate(candidate);
      completed += 1;
      input.logger?.info(
        {
          completed,
          total: probed.length,
          hits: result.hits,
          failed: result.failed ?? false,
          deadlineHit: result.deadlineHit ?? false,
          ms: Date.now() - startedAt,
          text: candidate.text,
        },
        "yield probe candidate complete",
      );

      return result;
    },
  );

  const survivorsUnranked: ProbedCandidate[] = [];
  const dropped: ProbedCandidate[] = [];
  probed.forEach((candidate, index) => {
    const result = results[index];
    const hits = result?.hits ?? 0;
    const probeFailed = result?.failed ?? false;
    const probedCandidate: ProbedCandidate = { ...candidate, hits };
    if (probeFailed || hits >= input.minResults) {
      survivorsUnranked.push(probedCandidate);
    } else {
      dropped.push(probedCandidate);
    }
  });

  survivorsUnranked.sort((left, right) => right.hits - left.hits);
  const survivors: ProbeSurvivor[] = survivorsUnranked.map(
    (candidate, index) => ({ ...candidate, rank: index + 1 }),
  );

  const providerUsage: ProbeProviderUsage[] = input.providers.map((entry) => ({
    name: entry.provider,
    calls: callCounts.get(entry.provider) ?? 0,
  }));

  return {
    survivors,
    dropped,
    telemetry: {
      candidates: input.candidates.length,
      deduped: deduped.length,
      dropped: dropped.map((candidate) => candidate.text),
      survivors: survivors.length,
      providerUsage,
      searchCredits: creditsSink.credits,
    },
  };
};
