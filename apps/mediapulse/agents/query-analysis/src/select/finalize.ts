import {
  NEWSLETTER_SECTION_IDS,
  summarizeSectionCoverage,
  type NewsletterSectionId,
  type QueryAnalysisIntent,
} from "@workspace/agent-data-api-contract";

import { normalizeQueryText } from "../pipeline/candidates";
import { isPerishableQuery } from "../pipeline/perishable";
import { isVagueQuery, type QuerySubject } from "../pipeline/specificity";
import type { Candidate, Language } from "../pipeline/types";

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
};

/**
 * Selects the persisted query set: the first `queriesPerIntent` candidates for each intent, taking
 * durable phrasings ahead of perishable ones and otherwise keeping generation order, then
 * guarantees both phrasing languages appear across the set.
 *
 * - Important: perishable candidates are ordered last rather than removed, so an intent whose
 *   candidates are all dated still fills its budget instead of shipping an empty section.
 *
 * @param params - Generated candidates and the per-intent query budget.
 * @returns Ranked queries plus per-intent, per-section, and language telemetry.
 */
export const finalizeQueries = (params: {
  candidates: Candidate[];
  queriesPerIntent: number;
  subject?: QuerySubject;
}): FinalizeResult => {
  const { candidates, queriesPerIntent, subject } = params;

  const poolByKey = new Map<string, Candidate>();
  for (const candidate of candidates) {
    const key = normalizeQueryText(candidate.text);
    if (key.length === 0 || poolByKey.has(key)) {
      continue;
    }
    poolByKey.set(key, candidate);
  }
  const pool = [...poolByKey.values()];

  const byIntent = new Map<QueryAnalysisIntent, Candidate[]>();
  for (const candidate of pool) {
    const list = byIntent.get(candidate.intent) ?? [];
    list.push(candidate);
    byIntent.set(candidate.intent, list);
  }

  const chosen: Candidate[] = [];
  const chosenKeys = new Set<string>();
  for (const list of byIntent.values()) {
    // Two demotions, applied in order of how little the query says. A vague query names nothing
    // tying it to this issuer's market, so it wastes a search slot on whatever the web returns; a
    // perishable one was specific when its date was current. Ordering rather than removing keeps an
    // intent from shipping empty when every candidate it has is weak.
    const specific =
      subject === undefined
        ? list
        : list.filter((candidate) => !isVagueQuery(candidate.text, subject));
    const vague =
      subject === undefined
        ? []
        : list.filter((candidate) => isVagueQuery(candidate.text, subject));
    const durableFirst = [
      ...specific.filter((candidate) => !isPerishableQuery(candidate.text)),
      ...specific.filter((candidate) => isPerishableQuery(candidate.text)),
      ...vague.filter((candidate) => !isPerishableQuery(candidate.text)),
      ...vague.filter((candidate) => isPerishableQuery(candidate.text)),
    ];
    for (const candidate of durableFirst.slice(0, queriesPerIntent)) {
      chosenKeys.add(normalizeQueryText(candidate.text));
      chosen.push(candidate);
    }
  }

  ensureLanguageMix(chosen, chosenKeys, pool);

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
  };
};

const ensureLanguageMix = (
  chosen: Candidate[],
  chosenKeys: Set<string>,
  pool: Candidate[],
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
    for (let index = chosen.length - 1; index >= 0; index -= 1) {
      const candidate = chosen[index];
      if (candidate === undefined) {
        continue;
      }
      const sameLanguageCount = chosen.filter(
        (other) => other.language === candidate.language,
      ).length;
      if (sameLanguageCount > 1) {
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
