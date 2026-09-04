import { tokenize } from "./phrase-link-injector.js";
import {
  distinctiveAnchorTokens,
  shingleIntersectionCount,
} from "./text-similarity.js";

/** One summarized item, reduced to what duplicate detection compares. */
export type SummarizedEvent = {
  title: string;
  points: readonly string[];
};

/**
 * Minimum shared anchors between two summarized headings before they are one event.
 *
 * Higher than the source-level headline threshold because both headings are now English, written by
 * one model from one instruction set. Two summaries of one story converge hard, so a coincidental
 * three-anchor overlap is likelier here than it is across two publishers' own wording.
 */
export const SUMMARIZED_EVENT_MIN_SHARED_ANCHORS = 4;

/** Minimum anchor containment alongside {@link SUMMARIZED_EVENT_MIN_SHARED_ANCHORS}. */
export const SUMMARIZED_EVENT_MIN_CONTAINMENT = 0.75;

const anchorsOf = (event: SummarizedEvent): Set<string> =>
  distinctiveAnchorTokens(tokenize(event.title));

/**
 * Finds a kept item covering the same event as `candidate`.
 *
 * Source-level dedup runs before any model call, which is right for cost and wrong for language: it
 * compares each publisher's own title, so an Indonesian report and an English one about one event
 * share only the words the two languages spell alike. On 2026-09-04 a GOTO issue carried the same
 * OJK story twice, from Fortune IDN and ambcrypto, because
 * `{ekonomi, chain, indonesia, segera, hadir}` and `{indonesia, chain, economy, coming}` share two
 * anchors against a threshold of three. After summarization both headings are English and the same
 * pair shares four anchors at full containment.
 *
 * @param candidate - The item being considered.
 * @param kept - Items already accepted for this issue.
 * @returns Index of the matching kept item, or `undefined` when the candidate is new.
 */
export const findSummarizedEventMatch = (
  candidate: SummarizedEvent,
  kept: readonly SummarizedEvent[],
): number | undefined => {
  const candidateAnchors = anchorsOf(candidate);
  if (candidateAnchors.size === 0) {
    return undefined;
  }

  for (const [index, entry] of kept.entries()) {
    const entryAnchors = anchorsOf(entry);
    if (entryAnchors.size === 0) {
      continue;
    }
    const shared = shingleIntersectionCount(candidateAnchors, entryAnchors);
    if (shared < SUMMARIZED_EVENT_MIN_SHARED_ANCHORS) {
      continue;
    }
    const containment =
      shared / Math.min(candidateAnchors.size, entryAnchors.size);
    if (containment >= SUMMARIZED_EVENT_MIN_CONTAINMENT) {
      return index;
    }
  }

  return undefined;
};
