import type {
  IndustryBulletResolved,
  IndustryNewsletterResolved,
  IndustryQuickHitResolved,
} from "../industry-newsletter-urls.js";

import {
  buildWordShingles,
  shingleJaccardSimilarity,
} from "./citation-grounding.js";
import { tokenize } from "./phrase-link-injector.js";

/** A previously published bullet, flattened from a recent newsletter. */
export type RecentBullet = {
  sectionKey: string;
  bulletText: string;
};

/** Outcome of the cross-run (cross-day) dedup pass. */
export type CrossRunDedupResult = {
  resolved: IndustryNewsletterResolved;
  removedCount: number;
  /** Removed counts keyed by section. Only sections with removals appear. */
  bySection: Record<string, number>;
};

/**
 * Jaccard threshold above which a bullet is treated as repeating a recently published one.
 * Matches the within-run dedup threshold so both passes agree on what "the same story" means.
 */
export const CROSS_RUN_DEDUP_SIMILARITY = 0.55;

/**
 * Minimum items kept per originally non-empty section. The wire serializer refuses to emit a
 * zero-row section, and gutting a section on an overlapping day is worse than one repeated point,
 * so this pass never empties a section — it rescues the most novel item when every item matched.
 */
const MIN_KEPT_PER_SECTION = 1;

type ResolvedItem = IndustryBulletResolved | IndustryQuickHitResolved;

const itemComparisonText = (item: ResolvedItem): string =>
  `${item.title ?? ""} ${item.text}`;

/**
 * Filters one section's items against the recent-bullet shingle corpus.
 *
 * An item is dropped when its max Jaccard similarity to any recent bullet is `>= minSimilarity`.
 * Uncited items (no `url`) are always kept, mirroring the within-run pass. At least
 * ``MIN_KEPT_PER_SECTION`` item(s) are always retained (the most novel), so a non-empty section is
 * never emptied by this pass.
 */
const dedupeSectionAgainstRecent = <Item extends ResolvedItem>(
  items: Item[],
  corpusShingles: ReadonlyArray<Set<string>>,
  minSimilarity: number,
): { kept: Item[]; removedCount: number } => {
  if (items.length === 0 || corpusShingles.length === 0) {
    return { kept: items, removedCount: 0 };
  }

  const decisions = items.map((item) => {
    if (item.url === undefined) {
      return { item, similarity: -1, drop: false };
    }
    const itemShingles = buildWordShingles(tokenize(itemComparisonText(item)));
    let maxSimilarity = 0;
    for (const shingles of corpusShingles) {
      const similarity = shingleJaccardSimilarity(itemShingles, shingles);
      if (similarity > maxSimilarity) {
        maxSimilarity = similarity;
      }
    }
    return {
      item,
      similarity: maxSimilarity,
      drop: maxSimilarity >= minSimilarity,
    };
  });

  // Floor: never empty a section. Rescue the most novel (lowest-similarity) dropped item(s).
  const keptCount = decisions.filter((decision) => !decision.drop).length;
  if (keptCount < MIN_KEPT_PER_SECTION) {
    const rescueCandidates = decisions
      .filter((decision) => decision.drop)
      .sort((left, right) => left.similarity - right.similarity);
    const rescueNeeded = MIN_KEPT_PER_SECTION - keptCount;
    for (
      let index = 0;
      index < rescueNeeded && index < rescueCandidates.length;
      index += 1
    ) {
      rescueCandidates[index]!.drop = false;
    }
  }

  const kept = decisions
    .filter((decision) => !decision.drop)
    .map((decision) => decision.item);

  return { kept, removedCount: items.length - kept.length };
};

/**
 * Removes bullets that repeat recently published newsletter bullets (cross-day dedup).
 *
 * Mirrors {@link dedupeWithinRun} but compares each item against an external corpus of recent
 * bullets (not the current run), using n-gram Jaccard similarity, and enforces a per-section floor
 * so a section is never emptied purely by this pass. Runs on the resolved structure after the
 * within-run dedup and before wire serialization.
 *
 * @param resolved - Resolved newsletter after URL attachment, citation pruning, and within-run dedup.
 * @param recentBullets - Bullets published in recent newsletters for this ticker.
 * @param minSimilarity - Jaccard threshold above which an item repeats a recent bullet.
 */
export const dedupeAgainstRecentBullets = (
  resolved: IndustryNewsletterResolved,
  recentBullets: ReadonlyArray<RecentBullet>,
  minSimilarity: number = CROSS_RUN_DEDUP_SIMILARITY,
): CrossRunDedupResult => {
  const bySection: Record<string, number> = {};
  if (recentBullets.length === 0) {
    return { resolved, removedCount: 0, bySection };
  }

  const corpusShingles = recentBullets.map((bullet) =>
    buildWordShingles(tokenize(bullet.bulletText)),
  );
  let removedCount = 0;

  const applySection = <Item extends ResolvedItem>(
    key: string,
    items: Item[],
  ): Item[] | undefined => {
    const { kept, removedCount: removed } = dedupeSectionAgainstRecent(
      items,
      corpusShingles,
      minSimilarity,
    );
    if (removed > 0) {
      bySection[key] = removed;
      removedCount += removed;
    }

    return kept.length > 0 ? kept : undefined;
  };

  const next: IndustryNewsletterResolved = { ...resolved };

  if (next.competitiveLandscape !== undefined) {
    const kept = applySection(
      "competitiveLandscape",
      next.competitiveLandscape.bullets,
    );
    next.competitiveLandscape = kept
      ? { ...next.competitiveLandscape, bullets: kept }
      : undefined;
  }

  if (next.dealsAndMovements !== undefined) {
    const kept = applySection(
      "dealsAndMovements",
      next.dealsAndMovements.bullets,
    );
    next.dealsAndMovements = kept
      ? { ...next.dealsAndMovements, bullets: kept }
      : undefined;
  }

  if (next.regulatoryPolicyWatch !== undefined) {
    const kept = applySection(
      "regulatoryPolicyWatch",
      next.regulatoryPolicyWatch.bullets,
    );
    next.regulatoryPolicyWatch = kept
      ? { ...next.regulatoryPolicyWatch, bullets: kept }
      : undefined;
  }

  if (
    next.disruptorsOrTech !== undefined &&
    next.disruptorsOrTech.format === "bullets"
  ) {
    const kept = applySection(
      "disruptorsOrTech",
      next.disruptorsOrTech.bullets,
    );
    next.disruptorsOrTech = kept
      ? { ...next.disruptorsOrTech, bullets: kept }
      : undefined;
  }

  if (next.quickHits !== undefined) {
    const kept = applySection("quickHits", next.quickHits.items);
    next.quickHits = kept ? { ...next.quickHits, items: kept } : undefined;
  }

  return { resolved: next, removedCount, bySection };
};
