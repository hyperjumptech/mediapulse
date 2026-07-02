import { verifyUnsubscribeToken } from "@workspace/utils";
import { env } from "@mediapulse/env/app-user-registration";

/**
 * Read-only display state for the unsubscribe confirmation page.
 *
 * `valid` carries the ticker symbol for the confirmation prompt; the invalid
 * variants map directly to the token verification failure reasons.
 */
export type UnsubscribeTokenView =
  | { valid: true; tickerSymbol: string }
  | { valid: false; reason: "expired" | "invalid" };

/**
 * Verifies an unsubscribe token for display, without writing anything.
 *
 * - Important: this never touches the database and never unsubscribes. It only decodes the
 *   HMAC token so the page can show the ticker and validity before the user confirms.
 *
 * @param token - Raw token from the URL query parameter (may be empty).
 * @param secret - HMAC secret. Defaults to the app's `UNSUBSCRIBE_SECRET`.
 * @returns The display state for the confirmation page.
 */
export const readUnsubscribeToken = (
  token: string,
  secret: string = env.UNSUBSCRIBE_SECRET,
): UnsubscribeTokenView => {
  if (!token) {
    return { valid: false, reason: "invalid" };
  }

  const result = verifyUnsubscribeToken(token, secret);
  if (!result.valid) {
    return { valid: false, reason: result.reason };
  }

  return { valid: true, tickerSymbol: result.tickerSymbol };
};
