import type { SourceForGeneration } from "../types.js";
import {
  buildSourceComparisonText,
  scoreTextAgainstText,
} from "./text-similarity.js";

/** A previously published bullet, flattened from a recent newsletter. */
export type RecentBullet = {
  sectionKey: string;
  bulletText: string;
};

/** Outcome of the cross-run (cross-day) dedup pass. */
export type CrossRunDedupResult = {
  sources: SourceForGeneration[];
  removedCount: number;
  /** Removed counts keyed by the source's upstream section. Only sections with removals appear. */
  bySection: Record<string, number>;
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

const SECTION_KEY_UNASSIGNED = "unassigned";

const sectionKeyOf = (source: SourceForGeneration): string =>
  source.section ?? SECTION_KEY_UNASSIGNED;

type Decision = {
  source: SourceForGeneration;
  order: number;
  similarity: number;
  drop: boolean;
};

/**
 * Scores one candidate source against every recent bullet and keeps the strongest match.
 */
const scoreAgainstRecentBullets = (
  source: SourceForGeneration,
  recentBullets: ReadonlyArray<RecentBullet>,
): number => {
  const referenceText = buildSourceComparisonText(source);
  let maxSimilarity = 0;
  for (const bullet of recentBullets) {
    const similarity = scoreTextAgainstText(bullet.bulletText, referenceText);
    if (similarity > maxSimilarity) {
      maxSimilarity = similarity;
    }
  }

  return maxSimilarity;
};

/**
 * Removes candidate sources whose story was already told by a recently published bullet.
 *
 * Runs before any LLM call so no tokens are spent summarizing an article that is about to be
 * discarded. A per-section floor keeps at least one candidate in every section that had one, so a
 * heavily overlapping day still leaves the selector something to choose from.
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
    return { sources: [...sources], removedCount: 0, bySection };
  }

  const decisions: Decision[] = sources.map((source, order) => {
    const similarity = scoreAgainstRecentBullets(source, recentBullets);

    return { source, order, similarity, drop: similarity >= minSimilarity };
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
    const rescueCandidates = bucket
      .filter((decision) => decision.drop)
      .sort((left, right) => left.similarity - right.similarity);
    const rescueNeeded = MIN_KEPT_PER_SECTION - keptCount;
    for (const decision of rescueCandidates.slice(0, rescueNeeded)) {
      decision.drop = false;
    }
  }

  let removedCount = 0;
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

  return { sources: kept, removedCount, bySection };
};
