import type {
  IndustryBulletResolved,
  IndustryNewsletterResolved,
  IndustryQuickHitResolved,
} from "../industry-newsletter-urls.js";

import {
  distinctiveAnchorTokens,
  shingleIntersectionCount,
} from "./citation-grounding.js";
import { tokenize } from "./phrase-link-injector.js";

/** One dropped bullet, recorded so a reviewer can see which event it collapsed into. */
export type EventDedupDrop = {
  sectionKey: string;
  matchedSectionKey: string;
  sharedAnchors: number;
  containment: number;
  title: string;
};

/** Outcome of the cross-section same-event dedup pass. */
export type EventDedupResult = {
  resolved: IndustryNewsletterResolved;
  removedCount: number;
  drops: EventDedupDrop[];
};

/**
 * Minimum shared distinctive anchors (named entities and multi-digit figures) before two bullets are
 * treated as the same event. Higher than the grounding anchor guard because a false merge here drops
 * real content, so precision matters more than recall.
 */
export const EVENT_DEDUP_MIN_SHARED_ANCHORS = 4;

/**
 * Minimum anchor containment (`shared / smaller anchor set`) alongside the shared-count guard. Uses
 * containment rather than Jaccard so a short bullet whose anchors are a subset of a longer lead or
 * bullet still matches, which Jaccard under-scores.
 */
export const EVENT_DEDUP_MIN_CONTAINMENT = 0.4;

type ResolvedItem = IndustryBulletResolved | IndustryQuickHitResolved;

/** An event already shipped in a higher-priority section, keyed by its distinctive anchors. */
type EventEntry = { sectionKey: string; anchors: Set<string> };

type EventMatch = { entry: EventEntry; shared: number; containment: number };

const anchorsFor = (item: { title?: string; text: string }): Set<string> =>
  distinctiveAnchorTokens(tokenize(`${item.title ?? ""} ${item.text}`));

const roundTwo = (value: number): number => Math.round(value * 100) / 100;

/**
 * Finds the strongest already-shipped event an item's anchors match, or `undefined` when none clears
 * both the shared-count and containment guards. Ties on shared count keep the first (higher-priority)
 * entry, since the corpus is filled in section-priority order.
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
 * Filters one section against the growing corpus of higher-priority events, dropping bullets whose
 * anchors match an already-shipped event and adding survivors to the corpus. Uncited items (no `url`)
 * are always kept. Unlike the cross-day pass this has no per-section floor: a section whose only
 * bullets duplicate higher-priority events is correctly emptied (the best-placed copy already ships),
 * and the caller drops an empty section to `undefined`.
 */
const applySection = <Item extends ResolvedItem>(
  sectionKey: string,
  items: Item[],
  corpus: EventEntry[],
  drops: EventDedupDrop[],
  minShared: number,
  minContainment: number,
): Item[] => {
  const kept: Item[] = [];
  for (const item of items) {
    if (item.url === undefined) {
      kept.push(item);
      continue;
    }
    const anchors = anchorsFor(item);
    const match = findEventMatch(anchors, corpus, minShared, minContainment);
    if (match !== undefined) {
      drops.push({
        sectionKey,
        matchedSectionKey: match.entry.sectionKey,
        sharedAnchors: match.shared,
        containment: roundTwo(match.containment),
        title: item.title ?? "",
      });
      continue;
    }
    kept.push(item);
    if (anchors.size > 0) {
      corpus.push({ sectionKey, anchors });
    }
  }

  return kept;
};

/**
 * Removes bullets that repeat, in a lower-priority section, an event already shipped in a
 * higher-priority section but worded differently enough that lexical title/text dedup misses it.
 *
 * Runs after {@link dedupeWithinRun} on the resolved structure. Events are keyed by distinctive,
 * translation-stable anchors (named entities and multi-digit figures). Sections are processed in
 * canonical priority order (Industry Pulse lead first), so the highest-priority placement of an event
 * wins and later duplicates drop. A section whose bullets all duplicate higher-priority events is
 * dropped to `undefined`.
 *
 * @param resolved - Resolved newsletter after URL attachment, citation pruning, and within-run dedup.
 * @param minSharedAnchors - Minimum shared anchors before two bullets are the same event.
 * @param minContainment - Minimum anchor containment alongside the shared-count guard.
 */
export const dedupeCrossSectionEvents = (
  resolved: IndustryNewsletterResolved,
  minSharedAnchors: number = EVENT_DEDUP_MIN_SHARED_ANCHORS,
  minContainment: number = EVENT_DEDUP_MIN_CONTAINMENT,
): EventDedupResult => {
  const corpus: EventEntry[] = [];
  const drops: EventDedupDrop[] = [];
  const next: IndustryNewsletterResolved = { ...resolved };

  // Seed the Industry Pulse lead as the highest-priority event. The lead itself is never dropped;
  // it only suppresses lower-section bullets that cover the same event.
  if (next.industryPulse !== undefined) {
    const leadAnchors = anchorsFor({
      ...(next.industryPulse.title !== undefined
        ? { title: next.industryPulse.title }
        : {}),
      text: next.industryPulse.prose,
    });
    if (leadAnchors.size > 0) {
      corpus.push({ sectionKey: "industryPulse", anchors: leadAnchors });
    }
  }

  const runSection = <Item extends ResolvedItem>(
    sectionKey: string,
    items: Item[],
  ): Item[] =>
    applySection(
      sectionKey,
      items,
      corpus,
      drops,
      minSharedAnchors,
      minContainment,
    );

  if (next.competitiveLandscape !== undefined) {
    const kept = runSection(
      "competitiveLandscape",
      next.competitiveLandscape.bullets,
    );
    next.competitiveLandscape =
      kept.length > 0
        ? { ...next.competitiveLandscape, bullets: kept }
        : undefined;
  }

  if (next.dealsAndMovements !== undefined) {
    const kept = runSection(
      "dealsAndMovements",
      next.dealsAndMovements.bullets,
    );
    next.dealsAndMovements =
      kept.length > 0
        ? { ...next.dealsAndMovements, bullets: kept }
        : undefined;
  }

  if (next.regulatoryPolicyWatch !== undefined) {
    const kept = runSection(
      "regulatoryPolicyWatch",
      next.regulatoryPolicyWatch.bullets,
    );
    next.regulatoryPolicyWatch =
      kept.length > 0
        ? { ...next.regulatoryPolicyWatch, bullets: kept }
        : undefined;
  }

  if (
    next.disruptorsOrTech !== undefined &&
    next.disruptorsOrTech.format === "bullets"
  ) {
    const kept = runSection("disruptorsOrTech", next.disruptorsOrTech.bullets);
    next.disruptorsOrTech =
      kept.length > 0 ? { ...next.disruptorsOrTech, bullets: kept } : undefined;
  }

  if (next.quickHits !== undefined) {
    const kept = runSection("quickHits", next.quickHits.items);
    next.quickHits =
      kept.length > 0 ? { ...next.quickHits, items: kept } : undefined;
  }

  return { resolved: next, removedCount: drops.length, drops };
};
