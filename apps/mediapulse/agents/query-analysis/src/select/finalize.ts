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

export const finalizeQueries = (params: {
  survivors: ProbeSurvivor[];
  dropped: ProbedCandidate[];
  queryCount: number;
  perIntentFloor: number;
  perIntentMax: number;
}): FinalizeResult => {
  const { survivors, dropped, queryCount, perIntentFloor, perIntentMax } =
    params;

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
  const intentCount = new Map<QueryAnalysisIntent, number>();
  const addCandidate = (candidate: ProbedCandidate): boolean => {
    if (chosen.length >= queryCount) {
      return false;
    }
    const key = normalizeQueryText(candidate.text);
    if (chosenKeys.has(key)) {
      return false;
    }
    chosenKeys.add(key);
    chosen.push(candidate);
    intentCount.set(
      candidate.intent,
      (intentCount.get(candidate.intent) ?? 0) + 1,
    );

    return true;
  };

  for (const list of byIntent.values()) {
    for (const candidate of list.slice(0, perIntentFloor)) {
      addCandidate(candidate);
    }
  }

  const rest = pool
    .filter((candidate) => !chosenKeys.has(normalizeQueryText(candidate.text)))
    .sort((left, right) => right.hits - left.hits);
  for (const candidate of rest) {
    if ((intentCount.get(candidate.intent) ?? 0) >= perIntentMax) {
      continue;
    }
    addCandidate(candidate);
  }

  ensureLanguageMix(
    chosen,
    chosenKeys,
    [...pool].sort((left, right) => right.hits - left.hits),
    [],
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
  protectedTexts: string[],
): void => {
  const protectedKeys = new Set(protectedTexts);
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
    for (let index = chosen.length - 1; index >= 0; index -= 1) {
      const candidate = chosen[index];
      if (
        candidate !== undefined &&
        !protectedKeys.has(normalizeQueryText(candidate.text))
      ) {
        evictIndex = index;
        break;
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
