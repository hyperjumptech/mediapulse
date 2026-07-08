import {
  NEWSLETTER_SECTION_IDS,
  SECTION_BY_INTENT,
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

/** Dedicated newsletter sections that must retain at least one query when possible. */
const DEDICATED_SECTIONS: NewsletterSectionId[] = [
  ...new Set(
    Object.values(SECTION_BY_INTENT).filter(
      (sectionId): sectionId is NewsletterSectionId => sectionId !== null,
    ),
  ),
];

const sectionOf = (intent: QueryAnalysisIntent): NewsletterSectionId | null =>
  SECTION_BY_INTENT[intent];

/**
 * Finalizes the persisted query set from probed candidates.
 *
 * - Guarantees at least one query per dedicated-intent section, reinstating the
 *   highest-yield dropped candidate for a starved section when needed.
 * - Truncates to `queryCount` while keeping an Indonesian + global (en) mix.
 * - Ranks the final set by probe hits (descending).
 *
 * @param params - Ranked survivors, dropped candidates, and the target set size.
 * @returns Persisted queries and per-intent/per-section/language telemetry.
 */
export const finalizeQueries = (params: {
  survivors: ProbeSurvivor[];
  dropped: ProbedCandidate[];
  queryCount: number;
}): FinalizeResult => {
  const { survivors, dropped, queryCount } = params;

  const coveredSections = new Set<NewsletterSectionId>();
  for (const survivor of survivors) {
    const section = sectionOf(survivor.intent);
    if (section !== null) {
      coveredSections.add(section);
    }
  }

  // Reinstate the best dropped candidate for each starved dedicated section.
  const reinstated: ProbedCandidate[] = [];
  const reinstatedKeys = new Set<string>();
  const survivorKeys = new Set(
    survivors.map((survivor) => normalizeQueryText(survivor.text)),
  );
  for (const section of DEDICATED_SECTIONS) {
    if (coveredSections.has(section)) {
      continue;
    }
    const candidate = dropped
      .filter((entry) => sectionOf(entry.intent) === section)
      .sort((left, right) => right.hits - left.hits)[0];
    if (candidate === undefined) {
      continue;
    }
    const key = normalizeQueryText(candidate.text);
    if (survivorKeys.has(key) || reinstatedKeys.has(key)) {
      continue;
    }
    reinstatedKeys.add(key);
    reinstated.push(candidate);
    coveredSections.add(section);
  }

  const protectedList = [...reinstated].sort(
    (left, right) => right.hits - left.hits,
  );
  const survivorPool = [...survivors]
    .filter(
      (survivor) => !reinstatedKeys.has(normalizeQueryText(survivor.text)),
    )
    .sort((left, right) => right.hits - left.hits);

  const chosen: ProbedCandidate[] = [];
  const chosenKeys = new Set<string>();
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

    return true;
  };

  for (const candidate of protectedList) {
    addCandidate(candidate);
  }
  for (const candidate of survivorPool) {
    addCandidate(candidate);
  }

  const droppedByHits = [...dropped].sort(
    (left, right) => right.hits - left.hits,
  );
  let usedFallback = false;
  if (chosen.length === 0) {
    usedFallback = true;
    for (const candidate of droppedByHits) {
      addCandidate(candidate);
    }
  }

  ensureLanguageMix(
    chosen,
    chosenKeys,
    usedFallback
      ? [...protectedList, ...survivorPool, ...droppedByHits]
      : [...protectedList, ...survivorPool],
    [...reinstatedKeys],
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

  return {
    queries,
    perIntent,
    perSection,
    idCount,
    globalCount,
    reinstated: reinstated.map((candidate) => candidate.text),
  };
};

/**
 * Best-effort swap so both languages appear in the final set when available,
 * never evicting a protected (reinstated) coverage query.
 */
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
    // Evict the lowest-yield non-protected chosen candidate.
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
