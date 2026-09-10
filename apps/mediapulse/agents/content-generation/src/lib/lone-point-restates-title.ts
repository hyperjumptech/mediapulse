import { tokenize } from "./phrase-link-injector.js";
import { distinctiveAnchorTokens } from "./text-similarity.js";

/**
 * Share of a point's distinctive tokens that must already appear in the heading.
 *
 * Measured against shipped items: the 2026-09-09 DSSA restatement scores 0.63, a point carrying a
 * fact the heading omits scores 0.13, and a point about a different subject scores 0.20. Half sits
 * clear of both, and the new-figure test below has to agree before anything is flagged.
 */
const MIN_TITLE_OVERLAP = 0.5;

const carriesDigit = (token: string): boolean => /\d/u.test(token);

/**
 * Reports whether an item's only point tells the reader nothing its heading did not.
 *
 * The heading renders directly above the bullet, so a lone point drawn from the heading's own words
 * fills space without adding a fact. On 2026-09-09 a DSSA Industry Pulse item headed "Government
 * Targets Additional 42.6 GW of Renewable Energy Until 2034" shipped over the single bullet "The
 * government targets an addition of 42.6 GW capacity in new and renewable energy projects by 2034".
 * The article body was never fetched, so the summarizer held a 150-character description that
 * restated the headline and nothing else.
 *
 * Two signals must agree: most of the point's distinctive tokens already appear in the heading, and
 * the point introduces no figure the heading lacks. A point that reaches past the heading for a
 * date, a base, or a share fails the second test and is kept.
 *
 * - Important: {@link lonePointLacksFact} does not catch this. That guard requires the point to
 *   carry no digit at all, and a restated heading usually repeats the heading's own figure.
 *
 * - Important: applies solely to a lone point, and is meant to trigger one more summarization
 *   attempt rather than a drop. A second point makes the item worth reading even when the first
 *   echoes the heading.
 *
 * @param points - The sanitized, grounded summary points.
 * @param title - The heading rendered above the item.
 * @returns True when the item is a single point carrying nothing the heading did not.
 */
export const lonePointRestatesTitle = (
  points: readonly string[],
  title: string,
): boolean => {
  if (points.length !== 1) {
    return false;
  }
  const pointTokens = distinctiveAnchorTokens(tokenize(points[0] ?? ""));
  const titleTokens = distinctiveAnchorTokens(tokenize(title));
  if (pointTokens.size === 0 || titleTokens.size === 0) {
    return false;
  }

  let shared = 0;
  for (const token of pointTokens) {
    if (titleTokens.has(token)) {
      shared += 1;
      continue;
    }
    if (carriesDigit(token)) {
      return false;
    }
  }

  return shared / pointTokens.size >= MIN_TITLE_OVERLAP;
};
