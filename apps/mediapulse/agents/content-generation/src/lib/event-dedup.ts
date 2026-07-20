import { NEWSLETTER_SECTION_IDS } from "@workspace/agent-data-api-contract";

import type { SourceForGeneration } from "../types.js";
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

/** An event already kept in a higher-priority section, keyed by its distinctive anchors. */
type EventEntry = { sectionKey: string; anchors: Set<string> };

type EventMatch = { entry: EventEntry; shared: number; containment: number };

const SECTION_KEY_UNASSIGNED = "unassigned";

const sectionKeyOf = (source: SourceForGeneration): string =>
  source.section ?? SECTION_KEY_UNASSIGNED;

const scoreOf = (source: SourceForGeneration): number =>
  source.sectionScore ?? 0;

const anchorsFor = (source: SourceForGeneration): Set<string> =>
  distinctiveAnchorTokens(tokenize(buildSourceComparisonText(source)));

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
      const scoreDiff = scoreOf(right.source) - scoreOf(left.source);

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
    const match = findEventMatch(
      anchors,
      corpus,
      minSharedAnchors,
      minContainment,
    );
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
      corpus.push({ sectionKey, anchors });
    }
  }

  const kept = sources.filter((_source, order) => keptOrders.has(order));

  return { sources: kept, removedCount: drops.length, drops };
};
