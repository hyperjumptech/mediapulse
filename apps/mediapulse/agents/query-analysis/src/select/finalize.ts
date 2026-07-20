import {
  NEWSLETTER_SECTION_IDS,
  summarizeSectionCoverage,
  type NewsletterSectionId,
  type QueryAnalysisIntent,
} from "@workspace/agent-data-api-contract";

import { normalizeQueryText } from "../probe/yield-probe";
import type { ProbedCandidate, ProbeSurvivor } from "../probe/yield-probe";
import type { Language } from "../pipeline/types";

/** A persisted query row. */
export type FinalizedQuery = {
  text: string;
  intent: QueryAnalysisIntent;
  rank: number;
};

/** Result of finalization: persisted queries plus output telemetry. */
export type FinalizeResult = {
  queries: FinalizedQuery[];
  perIntent: Record<string, number>;
  perSection: Record<NewsletterSectionId, number>;
  idCount: number;
  globalCount: number;
  reinstated: string[];
};

/**
 * Selects the persisted query set: the top `queriesPerIntent` candidates by probe hits for each
 * intent, drawn from survivors and probe-dropped candidates alike so an intent still fills its
 * budget when nothing it generated yielded search results.
 *
 * @param params - Probe survivors, probe-dropped candidates, and the per-intent query budget.
 * @returns Ranked queries plus per-intent, per-section, and language telemetry.
 */
export const finalizeQueries = (params: {
  survivors: ProbeSurvivor[];
  dropped: ProbedCandidate[];
  queriesPerIntent: number;
}): FinalizeResult => {
  const { survivors, dropped, queriesPerIntent } = params;

  const survivorKeys = new Set(
    survivors.map((survivor) => normalizeQueryText(survivor.text)),
  );

  const poolByKey = new Map<string, ProbedCandidate>();
  for (const candidate of [...survivors, ...dropped]) {
    const key = normalizeQueryText(candidate.text);
    if (key.length === 0) {
      continue;
    }
    const existing = poolByKey.get(key);
    if (existing === undefined || candidate.hits > existing.hits) {
      poolByKey.set(key, candidate);
    }
  }
  const pool = [...poolByKey.values()];

  const byIntent = new Map<QueryAnalysisIntent, ProbedCandidate[]>();
  for (const candidate of pool) {
    const list = byIntent.get(candidate.intent) ?? [];
    list.push(candidate);
    byIntent.set(candidate.intent, list);
  }
  for (const list of byIntent.values()) {
    list.sort((left, right) => right.hits - left.hits);
  }

  const chosen: ProbedCandidate[] = [];
  const chosenKeys = new Set<string>();
  for (const list of byIntent.values()) {
    for (const candidate of list.slice(0, queriesPerIntent)) {
      chosenKeys.add(normalizeQueryText(candidate.text));
      chosen.push(candidate);
    }
  }

  ensureLanguageMix(
    chosen,
    chosenKeys,
    [...pool].sort((left, right) => right.hits - left.hits),
  );

  chosen.sort((left, right) => right.hits - left.hits);
  const queries: FinalizedQuery[] = chosen.map((candidate, index) => ({
    text: candidate.text,
    intent: candidate.intent,
    rank: index + 1,
  }));

  const perIntent: Record<string, number> = {};
  for (const query of queries) {
    perIntent[query.intent] = (perIntent[query.intent] ?? 0) + 1;
  }

  const coverage = summarizeSectionCoverage(
    queries.map((query) => query.intent),
  );
  const perSection = Object.fromEntries(
    NEWSLETTER_SECTION_IDS.map((sectionId) => [
      sectionId,
      coverage[sectionId].count,
    ]),
  ) as Record<NewsletterSectionId, number>;

  const idCount = chosen.filter(
    (candidate) => candidate.language === ("id" satisfies Language),
  ).length;
  const globalCount = chosen.length - idCount;

  const reinstated = chosen
    .filter(
      (candidate) => !survivorKeys.has(normalizeQueryText(candidate.text)),
    )
    .map((candidate) => candidate.text);

  return {
    queries,
    perIntent,
    perSection,
    idCount,
    globalCount,
    reinstated,
  };
};

const ensureLanguageMix = (
  chosen: ProbedCandidate[],
  chosenKeys: Set<string>,
  pool: ProbedCandidate[],
): void => {
  const languages: Language[] = ["id", "en"];
  for (const language of languages) {
    const hasLanguage = chosen.some(
      (candidate) => candidate.language === language,
    );
    if (hasLanguage) {
      continue;
    }
    const replacement = pool.find(
      (candidate) =>
        candidate.language === language &&
        !chosenKeys.has(normalizeQueryText(candidate.text)),
    );
    if (replacement === undefined) {
      continue;
    }
    let evictIndex = -1;
    let lowestHits = Number.POSITIVE_INFINITY;
    for (let index = 0; index < chosen.length; index += 1) {
      const candidate = chosen[index];
      if (candidate !== undefined && candidate.hits <= lowestHits) {
        lowestHits = candidate.hits;
        evictIndex = index;
      }
    }
    if (evictIndex === -1) {
      continue;
    }
    const evicted = chosen[evictIndex];
    if (evicted !== undefined) {
      chosenKeys.delete(normalizeQueryText(evicted.text));
    }
    chosen.splice(evictIndex, 1);
    chosen.push(replacement);
    chosenKeys.add(normalizeQueryText(replacement.text));
  }
};
