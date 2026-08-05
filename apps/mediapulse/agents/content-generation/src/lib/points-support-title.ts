import { tokenize } from "./phrase-link-injector.js";
import { distinctiveAnchorTokens } from "./text-similarity.js";

/**
 * Reports whether any summary point is about the same thing as the article's own heading.
 *
 * Judged across the whole article rather than per point, because a single point can legitimately
 * introduce vocabulary the headline never uses: a Bank Raya earnings item may carry a CASA ratio
 * that shares nothing with "Bank Raya posts Q2 profit". What is never legitimate is an item where
 * no point relates to the heading at all, as when "Prabowo Sends a Firm Message to Bank Indonesia"
 * ships over bullets about subsidised mortgages and microcredit disbursement.
 *
 * A heading with no distinctive tokens of its own cannot be tested, so it passes.
 *
 * @param title - The article's translated title.
 * @param points - The sanitized summary points.
 * @returns True when the item may ship, false when its points never touch its heading.
 */
export const pointsSupportTitle = (
  title: string,
  points: readonly string[],
): boolean => {
  const titleAnchors = distinctiveAnchorTokens(tokenize(title));
  if (titleAnchors.size === 0 || points.length === 0) {
    return true;
  }

  return points.some((point) => {
    for (const anchor of distinctiveAnchorTokens(tokenize(point))) {
      if (titleAnchors.has(anchor)) {
        return true;
      }
    }

    return false;
  });
};
