import type {
  NewsletterArticle,
  NewsletterDocument,
  NewsletterSection,
} from "@workspace/email-templates/newsletter-document";

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
  document: NewsletterDocument;
  removedCount: number;
  /** Removed counts keyed by section. Only sections with removals appear. */
  bySection: Record<string, number>;
};

/**
 * Jaccard threshold above which an article is treated as repeating a recently published one.
 * Matches the within-run dedup threshold so both passes agree on what "the same story" means.
 */
export const CROSS_RUN_DEDUP_SIMILARITY = 0.55;

/**
 * Minimum articles kept per originally non-empty section. Gutting a section on an overlapping day
 * is worse than one repeated point, so this pass never empties a section — it rescues the most
 * novel article when every article matched.
 */
const MIN_KEPT_PER_SECTION = 1;

const articleComparisonText = (article: NewsletterArticle): string =>
  `${article.title} ${article.points.join(" ")}`;

/**
 * Filters one section's articles against the recent-bullet shingle corpus.
 *
 * An article is dropped when its max Jaccard similarity to any recent bullet is `>= minSimilarity`.
 * At least ``MIN_KEPT_PER_SECTION`` article(s) are always retained (the most novel), so a non-empty
 * section is never emptied by this pass.
 */
const dedupeSectionAgainstRecent = (
  articles: ReadonlyArray<NewsletterArticle>,
  corpusShingles: ReadonlyArray<Set<string>>,
  minSimilarity: number,
): { kept: NewsletterArticle[]; removedCount: number } => {
  if (articles.length === 0 || corpusShingles.length === 0) {
    return { kept: [...articles], removedCount: 0 };
  }

  const decisions = articles.map((article) => {
    const articleShingles = buildWordShingles(
      tokenize(articleComparisonText(article)),
    );
    let maxSimilarity = 0;
    for (const shingles of corpusShingles) {
      const similarity = shingleJaccardSimilarity(articleShingles, shingles);
      if (similarity > maxSimilarity) {
        maxSimilarity = similarity;
      }
    }

    return {
      article,
      similarity: maxSimilarity,
      drop: maxSimilarity >= minSimilarity,
    };
  });

  // Floor: never empty a section. Rescue the most novel (lowest-similarity) dropped article(s).
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
    .map((decision) => decision.article);

  return { kept, removedCount: articles.length - kept.length };
};

/**
 * Removes articles that repeat recently published newsletter bullets (cross-day dedup).
 *
 * Mirrors {@link dedupeWithinRun} but compares each article against an external corpus of recent
 * bullets (not the current run), using n-gram Jaccard similarity, and enforces a per-section floor
 * so a section is never emptied purely by this pass.
 *
 * @param document - Document after citation pruning and within-run dedup.
 * @param recentBullets - Bullets published in recent newsletters for this ticker.
 * @param minSimilarity - Jaccard threshold above which an article repeats a recent bullet.
 */
export const dedupeAgainstRecentBullets = (
  document: NewsletterDocument,
  recentBullets: ReadonlyArray<RecentBullet>,
  minSimilarity: number = CROSS_RUN_DEDUP_SIMILARITY,
): CrossRunDedupResult => {
  const bySection: Record<string, number> = {};
  if (recentBullets.length === 0) {
    return { document, removedCount: 0, bySection };
  }

  const corpusShingles = recentBullets.map((bullet) =>
    buildWordShingles(tokenize(bullet.bulletText)),
  );
  const sections: NewsletterSection[] = [];
  let removedCount = 0;

  for (const section of document.sections) {
    const { kept, removedCount: removed } = dedupeSectionAgainstRecent(
      section.articles,
      corpusShingles,
      minSimilarity,
    );
    if (removed > 0) {
      bySection[section.key] = removed;
      removedCount += removed;
    }
    if (kept.length > 0) {
      sections.push({ key: section.key, articles: kept });
    }
  }

  return { document: { version: 1, sections }, removedCount, bySection };
};
