import { tokenize } from "./phrase-link-injector.js";
import { distinctiveAnchorTokens } from "./text-similarity.js";

/**
 * Market vocabulary that says nothing about which story an item is covering.
 *
 * `distinctiveAnchorTokens` counts any token of four or more characters, which is right for dedup
 * (two reports sharing "investors" plus several named entities are the same story) and wrong here.
 * On 2026-08-19 an AADI Quick Hit headed "IHSG Predicted to Strengthen, Retail Investors Can Watch
 * Stocks AADI, ANTM, and VKTR" shipped over a single bullet about the BI Rate holding at 5.75%,
 * because both strings contain "investors".
 *
 * - Important: scoped to this guard. Dedup must keep counting these tokens.
 */
const GENERIC_MARKET_TERMS: ReadonlySet<string> = new Set([
  "analyst",
  "analysts",
  "bursa",
  "company",
  "companies",
  "emiten",
  "index",
  "indeks",
  "investor",
  "investors",
  "issuer",
  "market",
  "markets",
  "pasar",
  "price",
  "prices",
  "saham",
  "share",
  "shares",
  "stock",
  "stocks",
  "trading",
]);

/**
 * Short all-caps names such as `BRI`, `BCA`, or `IHSG`.
 *
 * `distinctiveAnchorTokens` keeps tokens of four characters or more, which drops three-letter
 * tickers. Those are the most subject-identifying tokens a heading carries, so they are collected
 * separately from the raw text before case is folded away.
 */
const SHORT_UPPERCASE_NAME = /\b[\p{Lu}]{2,5}\b/gu;

/**
 * Anchors that identify which story a text is about, with market filler removed.
 *
 * @param text - Heading or summary point.
 * @returns Anchor tokens naming the subject.
 */
const subjectAnchors = (text: string): Set<string> => {
  const anchors = new Set<string>();
  const add = (token: string): void => {
    if (!GENERIC_MARKET_TERMS.has(token)) {
      anchors.add(token);
    }
  };
  for (const anchor of distinctiveAnchorTokens(tokenize(text))) {
    add(anchor);
  }
  for (const match of text.matchAll(SHORT_UPPERCASE_NAME)) {
    add(match[0].toLocaleLowerCase());
  }

  return anchors;
};

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
  const titleAnchors = subjectAnchors(title);
  if (titleAnchors.size === 0 || points.length === 0) {
    return true;
  }

  return points.some((point) => {
    for (const anchor of subjectAnchors(point)) {
      if (titleAnchors.has(anchor)) {
        return true;
      }
    }

    return false;
  });
};
