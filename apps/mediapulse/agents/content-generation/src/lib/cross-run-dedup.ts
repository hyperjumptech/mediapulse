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
    // A figure match is not a fuzzy judgment, so it is never rescued. The rescue exists because
    // lexical similarity can be wrong about a section's only candidate; repeating the same
    // numbers a third morning is worse than shipping the section short.
    const rescueCandidates = bucket
      .filter((decision) => decision.drop && !decision.figureMatch)
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
