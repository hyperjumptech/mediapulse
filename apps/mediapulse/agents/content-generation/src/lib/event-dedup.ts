import type {
  NewsletterArticle,
  NewsletterDocument,
  NewsletterSection,
} from "@workspace/email-templates/newsletter-document";

import {
  distinctiveAnchorTokens,
  shingleIntersectionCount,
} from "./citation-grounding.js";
import { tokenize } from "./phrase-link-injector.js";

/** One dropped article, recorded so a reviewer can see which event it collapsed into. */
export type EventDedupDrop = {
  sectionKey: string;
  matchedSectionKey: string;
  sharedAnchors: number;
  containment: number;
  title: string;
};

/** Outcome of the cross-section same-event dedup pass. */
export type EventDedupResult = {
  document: NewsletterDocument;
  removedCount: number;
  drops: EventDedupDrop[];
};

/**
 * Minimum shared distinctive anchors (named entities and multi-digit figures) before two articles
 * are treated as the same event. Higher than the grounding anchor guard because a false merge here
 * drops real content, so precision matters more than recall.
 */
export const EVENT_DEDUP_MIN_SHARED_ANCHORS = 4;

/**
 * Minimum anchor containment (`shared / smaller anchor set`) alongside the shared-count guard. Uses
 * containment rather than Jaccard so a short article whose anchors are a subset of a longer one
 * still matches, which Jaccard under-scores.
 */
export const EVENT_DEDUP_MIN_CONTAINMENT = 0.4;

/** An event already shipped in a higher-priority section, keyed by its distinctive anchors. */
type EventEntry = { sectionKey: string; anchors: Set<string> };

type EventMatch = { entry: EventEntry; shared: number; containment: number };

const anchorsFor = (article: NewsletterArticle): Set<string> =>
  distinctiveAnchorTokens(
    tokenize(`${article.title} ${article.points.join(" ")}`),
  );

const roundTwo = (value: number): number => Math.round(value * 100) / 100;

/**
 * Finds the strongest already-shipped event an article's anchors match, or `undefined` when none
 * clears both the shared-count and containment guards. Ties on shared count keep the first
 * (higher-priority) entry, since the corpus is filled in section-priority order.
 */
const findEventMatch = (
  anchors: Set<string>,
  corpus: readonly EventEntry[],
  minShared: number,
  minContainment: number,
): EventMatch | undefined => {
  if (anchors.size === 0) {
    return undefined;
  }

  let best: EventMatch | undefined;
  for (const entry of corpus) {
    if (entry.anchors.size === 0) {
      continue;
    }
    const shared = shingleIntersectionCount(anchors, entry.anchors);
    if (shared < minShared) {
      continue;
    }
    const containment = shared / Math.min(anchors.size, entry.anchors.size);
    if (containment < minContainment) {
      continue;
    }
    if (best === undefined || shared > best.shared) {
      best = { entry, shared, containment };
    }
  }

  return best;
};

/**
 * Filters one section against the growing corpus of higher-priority events, dropping articles whose
 * anchors match an already-shipped event and adding survivors to the corpus. Unlike the cross-day
 * pass this has no per-section floor: a section whose only articles duplicate higher-priority events
 * is correctly emptied (the best-placed copy already ships), and the caller omits an empty section.
 */
const applySection = (
  sectionKey: string,
  articles: ReadonlyArray<NewsletterArticle>,
  corpus: EventEntry[],
  drops: EventDedupDrop[],
  minShared: number,
  minContainment: number,
): NewsletterArticle[] => {
  const kept: NewsletterArticle[] = [];
  for (const article of articles) {
    const anchors = anchorsFor(article);
    const match = findEventMatch(anchors, corpus, minShared, minContainment);
    if (match !== undefined) {
      drops.push({
        sectionKey,
        matchedSectionKey: match.entry.sectionKey,
        sharedAnchors: match.shared,
        containment: roundTwo(match.containment),
        title: article.title,
      });
      continue;
    }
    kept.push(article);
    if (anchors.size > 0) {
      corpus.push({ sectionKey, anchors });
    }
  }

  return kept;
};

/**
 * Removes articles that repeat, in a lower-priority section, an event already shipped in a
 * higher-priority section but worded differently enough that lexical title/text dedup misses it.
 *
 * Events are keyed by distinctive, translation-stable anchors (named entities and multi-digit
 * figures). Sections are processed in the document's canonical order, so the highest-priority
 * placement of an event wins and later duplicates drop. A section whose articles all duplicate
 * higher-priority events is omitted from the result.
 *
 * @param document - Document after citation pruning and within-run dedup.
 * @param minSharedAnchors - Minimum shared anchors before two articles are the same event.
 * @param minContainment - Minimum anchor containment alongside the shared-count guard.
 */
export const dedupeCrossSectionEvents = (
  document: NewsletterDocument,
  minSharedAnchors: number = EVENT_DEDUP_MIN_SHARED_ANCHORS,
  minContainment: number = EVENT_DEDUP_MIN_CONTAINMENT,
): EventDedupResult => {
  const corpus: EventEntry[] = [];
  const drops: EventDedupDrop[] = [];
  const sections: NewsletterSection[] = [];

  for (const section of document.sections) {
    const kept = applySection(
      section.key,
      section.articles,
      corpus,
      drops,
      minSharedAnchors,
      minContainment,
    );
    if (kept.length > 0) {
      sections.push({ key: section.key, articles: kept });
    }
  }

  return {
    document: { version: 1, sections },
    removedCount: drops.length,
    drops,
  };
};
