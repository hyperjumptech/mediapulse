/**
 * Framings that describe a thing's purpose or direction instead of reporting what happened.
 *
 * Each is fine inside a fuller item, where a sibling point carries the fact. Alone, it leaves the
 * reader an item that asserts nothing checkable: on 2026-09-04 an ANTM Deals item about three HPAL
 * smelters shipped over "The move supports nickel downstreaming and the supply chain for electric
 * vehicle batteries", and a DCII Industry Pulse item over "Growing data center investments in
 * industrial areas increase demand for land, electricity, and water".
 */
const PURPOSE_FRAMING =
  /\b(?:supports?|support(?:ed|ing)\s+by|aims?\s+to|aimed\s+at|focus(?:es|ed)\s+on|seeks?\s+to|helps?\s+to|is\s+expected\s+to|will\s+help|serves?\s+to|underscor(?:es|ing)|highlight(?:s|ing)|emphasi[sz](?:es|ing)|reflect(?:s|ing)|is\s+transforming|drives?\s+up|driving\s+up|increase[sd]?\s+demand|refocus(?:es|ing))\b/iu;

/** A checkable particular: a figure, a percentage, or a currency amount. */
const CARRIES_FIGURE = /\d/u;

/**
 * Reports whether an item's only point asserts nothing a reader can check.
 *
 * Applies solely to a lone point. The summarizer is told to write as many points as the article
 * earns and never to pad, so a one-point item is legitimate; a one-point item whose single sentence
 * states a purpose rather than an event is not.
 *
 * - Important: intended to trigger one more summarization attempt, never a drop. An item thinned to
 *   nothing is worse than a vague one, and thinness is the problem this sits inside.
 *
 * @param points - The sanitized, grounded summary points.
 * @returns True when the item is a single point carrying no fact.
 */
export const lonePointLacksFact = (points: readonly string[]): boolean => {
  if (points.length !== 1) {
    return false;
  }
  const point = points[0] ?? "";

  return !CARRIES_FIGURE.test(point) && PURPOSE_FRAMING.test(point);
};
