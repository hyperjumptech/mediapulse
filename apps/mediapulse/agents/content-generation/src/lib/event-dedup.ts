import { NEWSLETTER_SECTION_IDS } from "@workspace/agent-data-api-contract";

import type { SourceForGeneration } from "../types.js";
import { compareSourcesForRanking } from "./rank-sources.js";
import { tokenize } from "./phrase-link-injector.js";
import {
  buildSourceComparisonText,
  distinctiveAnchorTokens,
  shingleIntersectionCount,
} from "./text-similarity.js";

/** One dropped source, recorded so a reviewer can see which event it collapsed into. */
export type EventDedupDrop = {
  sectionKey: string;
  matchedSectionKey: string;
  sharedAnchors: number;
  containment: number;
  title: string;
};

/** Outcome of the cross-section same-event dedup pass. */
export type EventDedupResult = {
  sources: SourceForGeneration[];
  removedCount: number;
  drops: EventDedupDrop[];
};

/**
 * Minimum shared distinctive anchors (named entities and multi-digit figures) before two sources
 * are treated as the same event. A false merge here drops real content, so precision matters more
 * than recall.
 */
export const EVENT_DEDUP_MIN_SHARED_ANCHORS = 4;

/**
 * Minimum anchor containment (`shared / smaller anchor set`) alongside the shared-count guard. Uses
 * containment rather than Jaccard so a short article whose anchors are a subset of a longer one
 * still matches, which Jaccard under-scores.
 */
export const EVENT_DEDUP_MIN_CONTAINMENT = 0.4;

/**
 * Same-day headline path. Two same-day articles whose headlines share this many distinctive anchors
 * are two outlets telling one story, even when their lead paragraphs diverge enough to miss the
 * body-anchor guard above. Restricted to same-day pairs so a recurring headline shape ("coal price
 * falls") cannot collapse a week of separate moves into one.
 */
export const EVENT_DEDUP_TITLE_MIN_SHARED_ANCHORS = 3;

/** Minimum headline-anchor containment alongside {@link EVENT_DEDUP_TITLE_MIN_SHARED_ANCHORS}. */
export const EVENT_DEDUP_TITLE_MIN_CONTAINMENT = 0.4;

/** An event already kept in a higher-priority section, keyed by its distinctive anchors. */
type EventEntry = {
  sectionKey: string;
  anchors: Set<string>;
  titleAnchors: Set<string>;
  publishedDay?: string;
};

type EventMatch = { entry: EventEntry; shared: number; containment: number };

const SECTION_KEY_UNASSIGNED = "unassigned";

const sectionKeyOf = (source: SourceForGeneration): string =>
  source.section ?? SECTION_KEY_UNASSIGNED;

const anchorsFor = (source: SourceForGeneration): Set<string> =>
  distinctiveAnchorTokens(tokenize(buildSourceComparisonText(source)));

const titleAnchorsFor = (source: SourceForGeneration): Set<string> =>
  distinctiveAnchorTokens(tokenize(source.title));

/**
 * Calendar day of a source's publish timestamp, or `undefined` when it carries none.
 */
const publishedDayOf = (source: SourceForGeneration): string | undefined => {
  const publishedAt = source.publishedAt;
  if (publishedAt === undefined || publishedAt === null) {
    return undefined;
  }
  const day = publishedAt.slice(0, 10);

  return /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : undefined;
};

/**
 * Whether two publish days are close enough to be one story.
 *
 * Widened from an exact match because outlets stamp a wire story with their own publication date:
 * three reports of one earnings call routinely carry two or three different days, which skipped this
 * path entirely and let the same event ship twice.
 *
 * An absent day counts as close enough. Candidates all arrive from one rolling lookback window, so
 * an undated source is from the same cycle as everything beside it; requiring a stamp it does not
 * have only excused it from the check. `published_at` is missing on most rows in practice, which is
 * what kept this path from firing at all.
 */
const withinAdjacentDay = (
  left: string | undefined,
  right: string | undefined,
): boolean => {
  if (left === undefined || right === undefined) {
    return true;
  }
  if (left === right) {
    return true;
  }
  const leftTime = Date.parse(`${left}T00:00:00Z`);
  const rightTime = Date.parse(`${right}T00:00:00Z`);
  if (Number.isNaN(leftTime) || Number.isNaN(rightTime)) {
    return false;
  }

  return Math.abs(leftTime - rightTime) <= 86_400_000;
};

const roundTwo = (value: number): number => Math.round(value * 100) / 100;

/**
 * Finds the strongest already-kept event a source's anchors match, or `undefined` when none clears
 * both the shared-count and containment guards. Ties on shared count keep the first entry, since
 * the corpus is filled in section-priority order.
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
 * Finds a kept event whose headline matches this one on the same or an adjacent day. Runs only
 * after the body path misses. A missing publish day on either side no longer disqualifies the pair,
 * since every candidate in a run comes from the same rolling lookback window; the headline guards
 * still have to clear on their own.
 */
const findSameDayTitleMatch = (
  titleAnchors: Set<string>,
  publishedDay: string | undefined,
  corpus: readonly EventEntry[],
): EventMatch | undefined => {
  if (titleAnchors.size === 0) {
    return undefined;
  }

  let best: EventMatch | undefined;
  for (const entry of corpus) {
    if (
      !withinAdjacentDay(entry.publishedDay, publishedDay) ||
      entry.titleAnchors.size === 0
    ) {
      continue;
    }
    const shared = shingleIntersectionCount(titleAnchors, entry.titleAnchors);
    if (shared < EVENT_DEDUP_TITLE_MIN_SHARED_ANCHORS) {
      continue;
    }
    const containment =
      shared / Math.min(titleAnchors.size, entry.titleAnchors.size);
    if (containment < EVENT_DEDUP_TITLE_MIN_CONTAINMENT) {
      continue;
    }
    if (best === undefined || shared > best.shared) {
      best = { entry, shared, containment };
    }
  }

  return best;
};

/**
 * Orders candidates so the copy most likely to ship is seen first: canonical section priority, then
 * `sectionScore` descending, then the caller's ordering.
 */
const orderByPlacementPriority = (
  sources: readonly SourceForGeneration[],
): Array<{ source: SourceForGeneration; order: number }> => {
  const sectionRank = new Map<string, number>(
    NEWSLETTER_SECTION_IDS.map((id, index) => [id, index]),
  );
  const rankOf = (source: SourceForGeneration): number =>
    sectionRank.get(sectionKeyOf(source)) ?? NEWSLETTER_SECTION_IDS.length;

  return sources
    .map((source, order) => ({ source, order }))
    .sort((left, right) => {
      const rankDiff = rankOf(left.source) - rankOf(right.source);
      if (rankDiff !== 0) {
        return rankDiff;
      }
      const scoreDiff = compareSourcesForRanking(left.source, right.source);

      return scoreDiff !== 0 ? scoreDiff : left.order - right.order;
    });
};

/**
 * Removes candidate sources that repeat an event another candidate already covers from a
 * higher-priority placement, worded differently enough that lexical title dedup misses it.
 *
 * Events are keyed by distinctive, translation-stable anchors (named entities and multi-digit
 * figures) drawn from each source's title and lead body text. Candidates are visited in placement
 * priority order, so the best-placed copy of an event wins and later duplicates drop. Runs before
 * any LLM call, so a duplicate never costs a summarization request.
 *
 * A second, narrower path catches two outlets covering one story on the same day with lead
 * paragraphs too different for the body guard: same publish day plus
 * {@link EVENT_DEDUP_TITLE_MIN_SHARED_ANCHORS} shared headline anchors at
 * {@link EVENT_DEDUP_TITLE_MIN_CONTAINMENT} containment.
 *
 * @param sources - Candidate sources for this run.
 * @param minSharedAnchors - Minimum shared anchors before two sources are the same event.
 * @param minContainment - Minimum anchor containment alongside the shared-count guard.
 */
export const dedupeCrossSectionSourceEvents = (
  sources: readonly SourceForGeneration[],
  minSharedAnchors: number = EVENT_DEDUP_MIN_SHARED_ANCHORS,
  minContainment: number = EVENT_DEDUP_MIN_CONTAINMENT,
): EventDedupResult => {
  const corpus: EventEntry[] = [];
  const drops: EventDedupDrop[] = [];
  const keptOrders = new Set<number>();

  for (const entry of orderByPlacementPriority(sources)) {
    const sectionKey = sectionKeyOf(entry.source);
    const anchors = anchorsFor(entry.source);
    const titleAnchors = titleAnchorsFor(entry.source);
    const publishedDay = publishedDayOf(entry.source);
    const match =
      findEventMatch(anchors, corpus, minSharedAnchors, minContainment) ??
      findSameDayTitleMatch(titleAnchors, publishedDay, corpus);
    if (match !== undefined) {
      drops.push({
        sectionKey,
        matchedSectionKey: match.entry.sectionKey,
        sharedAnchors: match.shared,
        containment: roundTwo(match.containment),
        title: entry.source.title,
      });
      continue;
    }
    keptOrders.add(entry.order);
    if (anchors.size > 0) {
      corpus.push({
        sectionKey,
        anchors,
        titleAnchors,
        ...(publishedDay !== undefined ? { publishedDay } : {}),
      });
    }
  }

  const kept = sources.filter((_source, order) => keptOrders.has(order));

  return { sources: kept, removedCount: drops.length, drops };
};
