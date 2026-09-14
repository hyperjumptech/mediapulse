import type { SourceForGeneration } from "../types.js";
import { sharedFigureCount } from "./figures-grounded.js";
import {
  buildSourceComparisonText,
  scoreTextAgainstText,
} from "./text-similarity.js";

/** A previously published bullet, flattened from a recent newsletter. */
export type RecentBullet = {
  sectionKey: string;
  bulletText: string;
  dataSourceId?: string | null;
  url?: string | null;
};

/** Outcome of the cross-run (cross-day) dedup pass. */
export type CrossRunDedupResult = {
  sources: SourceForGeneration[];
  removedCount: number;
  /** Removed counts keyed by the source's upstream section. Only sections with removals appear. */
  bySection: Record<string, number>;
  /** Of `removedCount`, how many were dropped because the article itself already shipped. */
  removedByIdentity: number;
};

/**
 * Score above which a candidate source is treated as the story a recent bullet already told.
 */
export const CROSS_RUN_DEDUP_SIMILARITY = 0.55;

/**
 * Minimum sources kept per originally non-empty section. Gutting a section on an overlapping day
 * is worse than one repeated story, so this pass never empties a section, it rescues the most
 * novel candidate when every candidate matched.
 */
const MIN_KEPT_PER_SECTION = 1;

/**
 * Unit-bearing figures a candidate must share with a recent bullet to count as the same story.
 *
 * Lexical similarity misses a story rewritten by a second outlet: the same Telkom Akses port and
 * fibre counts shipped twice in three days from two publishers and scored under the threshold.
 * Two matching figures is not a paraphrase, and only percent, currency and scaled figures are
 * collected, so a shared year or article id cannot trip it.
 */
export const MIN_SHARED_FIGURES = 2;

const SECTION_KEY_UNASSIGNED = "unassigned";

/**
 * Reduces a URL to the key two records of the same article must agree on.
 *
 * - Important: query strings are preserved. A paginated article carries its page in the query, and
 *   those pages are separate records upstream.
 */
export const buildUrlIdentityKey = (rawUrl: string): string | undefined => {
  const trimmed = rawUrl.trim();
  if (trimmed.length === 0) {
    return undefined;
  }

  const withoutScheme = trimmed.replace(/^[a-z][a-z0-9+.-]*:\/\//i, "");
  const withoutHash = withoutScheme.split("#")[0] ?? "";
  const withoutWww = withoutHash.replace(/^www\./i, "");
  const normalized = withoutWww.toLowerCase().replace(/\/+$/, "");

  return normalized.length === 0 ? undefined : normalized;
};

/**
 * Collects the article identities a recent newsletter already spent.
 */
const buildShippedIdentity = (
  recentBullets: ReadonlyArray<RecentBullet>,
): { dataSourceIds: Set<string>; urlKeys: Set<string> } => {
  const dataSourceIds = new Set<string>();
  const urlKeys = new Set<string>();
  for (const bullet of recentBullets) {
    if (
      typeof bullet.dataSourceId === "string" &&
      bullet.dataSourceId.length > 0
    ) {
      dataSourceIds.add(bullet.dataSourceId);
    }
    if (typeof bullet.url === "string") {
      const key = buildUrlIdentityKey(bullet.url);
      if (key !== undefined) {
        urlKeys.add(key);
      }
    }
  }

  return { dataSourceIds, urlKeys };
};

/**
 * Reports whether this exact article already shipped in the recent window.
 */
const hasShipped = (
  source: SourceForGeneration,
  shipped: { dataSourceIds: Set<string>; urlKeys: Set<string> },
): boolean => {
  if (
    typeof source.dataSourceId === "string" &&
    shipped.dataSourceIds.has(source.dataSourceId)
  ) {
    return true;
  }
  const key = buildUrlIdentityKey(source.url);

  return key !== undefined && shipped.urlKeys.has(key);
};

const sectionKeyOf = (source: SourceForGeneration): string =>
  source.section ?? SECTION_KEY_UNASSIGNED;

type Decision = {
  source: SourceForGeneration;
  order: number;
  similarity: number;
  figureMatch: boolean;
  drop: boolean;
};

/**
 * Scores one candidate source against every recent bullet and keeps the strongest match.
 */
const scoreAgainstRecentBullets = (
  source: SourceForGeneration,
  recentBullets: ReadonlyArray<RecentBullet>,
): { similarity: number; figureMatch: boolean } => {
  const referenceText = buildSourceComparisonText(source);
  let maxSimilarity = 0;
  let figureMatch = false;
  for (const bullet of recentBullets) {
    const similarity = scoreTextAgainstText(bullet.bulletText, referenceText);
    if (similarity > maxSimilarity) {
      maxSimilarity = similarity;
    }
    if (
      sharedFigureCount(bullet.bulletText, referenceText) >= MIN_SHARED_FIGURES
    ) {
      figureMatch = true;
    }
  }

  return { similarity: maxSimilarity, figureMatch };
};

/**
 * Removes candidate sources whose story was already told by a recently published bullet.
 *
 * Runs before any LLM call so no tokens are spent summarizing an article that is about to be
 * discarded. Two passes apply in order:
 *
 * 1. Identity. A candidate that is the same record, or the same URL, as one a recent newsletter
 *    already cited is dropped outright.
 * 2. Wording. Whatever survives is scored against the recent bullets, with a per-section floor that
 *    keeps at least one candidate in every section that had one.
 *
 * - Important: the floor rescues only wording matches. An article that verifiably shipped is never
 *   rescued, because an empty section folds into Quick Hits while a rescued repeat reaches readers
 *   as the same story twice.
 *
 * - Important: the wording pass compares the candidate's own language against bullets already
 *   written in the newsletter's language, so it cannot see a translated repeat. Identity does not
 *   depend on language and carries that case.
 *
 * @param sources - Candidate sources for this run.
 * @param recentBullets - Bullets published in recent newsletters for this ticker.
 * @param minSimilarity - Score above which a source repeats a recent bullet.
 */
export const dedupeSourcesAgainstRecentBullets = (
  sources: readonly SourceForGeneration[],
  recentBullets: ReadonlyArray<RecentBullet>,
  minSimilarity: number = CROSS_RUN_DEDUP_SIMILARITY,
): CrossRunDedupResult => {
  const bySection: Record<string, number> = {};
  if (recentBullets.length === 0 || sources.length === 0) {
    return {
      sources: [...sources],
      removedCount: 0,
      bySection,
      removedByIdentity: 0,
    };
  }

  const shipped = buildShippedIdentity(recentBullets);
  const survivors: SourceForGeneration[] = [];
  let removedByIdentity = 0;
  for (const source of sources) {
    if (hasShipped(source, shipped)) {
      const sectionKey = sectionKeyOf(source);
      bySection[sectionKey] = (bySection[sectionKey] ?? 0) + 1;
      removedByIdentity += 1;
      continue;
    }
    survivors.push(source);
  }

  const decisions: Decision[] = survivors.map((source, order) => {
    const { similarity, figureMatch } = scoreAgainstRecentBullets(
      source,
      recentBullets,
    );

    return {
      source,
      order,
      similarity,
      figureMatch,
      drop: figureMatch || similarity >= minSimilarity,
    };
  });

  const decisionsBySection = new Map<string, Decision[]>();
  for (const decision of decisions) {
    const sectionKey = sectionKeyOf(decision.source);
    const bucket = decisionsBySection.get(sectionKey) ?? [];
    bucket.push(decision);
    decisionsBySection.set(sectionKey, bucket);
  }

  for (const bucket of decisionsBySection.values()) {
    const keptCount = bucket.filter((decision) => !decision.drop).length;
    if (keptCount >= MIN_KEPT_PER_SECTION) {
      continue;
    }
    const byNovelty = (left: Decision, right: Decision): number =>
      left.similarity - right.similarity;
    const dropped = bucket.filter((decision) => decision.drop);
    const rescueCandidates = [
      ...dropped.filter((decision) => !decision.figureMatch).sort(byNovelty),
      ...dropped.filter((decision) => decision.figureMatch).sort(byNovelty),
    ];
    const rescueNeeded = MIN_KEPT_PER_SECTION - keptCount;
    for (const decision of rescueCandidates.slice(0, rescueNeeded)) {
      decision.drop = false;
    }
  }

  let removedCount = removedByIdentity;
  const kept: SourceForGeneration[] = [];
  for (const decision of decisions) {
    if (!decision.drop) {
      kept.push(decision.source);
      continue;
    }
    const sectionKey = sectionKeyOf(decision.source);
    bySection[sectionKey] = (bySection[sectionKey] ?? 0) + 1;
    removedCount += 1;
  }

  return { sources: kept, removedCount, bySection, removedByIdentity };
};
