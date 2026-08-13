const STOP_WORDS = new Set([
  "a",
  "an",
  "the",
  "is",
  "are",
  "was",
  "were",
  "be",
  "been",
  "being",
  "to",
  "of",
  "and",
  "or",
  "in",
  "on",
  "at",
  "for",
  "with",
  "by",
  "as",
  "it",
  "its",
  "that",
  "this",
  "has",
  "had",
  "have",
  "not",
  "but",
  "from",
  "up",
  "all",
]);

const SCALE_WORDS =
  "triliun|trilyun|trillion|miliar|milyar|billion|juta|million|ribu|thousand|bn|mn|k";

const PERCENT_MARKERS = "%|(?:persen|percent|pct)\\b";

const CURRENCY_MARKERS = "rp|idr|usd|us\\$|\\$|eur|€|sgd|myr|jpy|¥|£|gbp";

const NUMBER = "\\d[\\d.,]*";

const GROUPED_FIGURE = /\b(\d{1,3}(?:[.,]\d{3})+)\b/g;

const FIGURE_KINDS: { kind: string; pattern: RegExp }[] = [
  {
    kind: "percent",
    pattern: new RegExp(`(${NUMBER})\\s*(?:${PERCENT_MARKERS})`, "gi"),
  },
  {
    kind: "currency",
    pattern: new RegExp(`(?:${CURRENCY_MARKERS})\\s*(${NUMBER})`, "gi"),
  },
  {
    kind: "scaled",
    pattern: new RegExp(`(${NUMBER})\\s*(?:${SCALE_WORDS})\\b`, "gi"),
  },
  { kind: "grouped", pattern: GROUPED_FIGURE },
];

/**
 * Splits text into meaningful lowercase terms, dropping stopwords and very short words.
 *
 * @param text - Raw text to tokenize.
 */
export const tokenize = (text: string): string[] =>
  String(text ?? "")
    .toLowerCase()
    .split(/\W+/)
    .filter((token) => token.length >= 3 && !STOP_WORDS.has(token));

/**
 * Distinctive, translation-stable tokens (named entities and multi-digit figures) from a token list.
 *
 * - Important: anchors survive an English-summary / Indonesian-source language gap where word
 *   n-grams do not, which is why matching keys on them rather than on shingles.
 *
 * @param tokens - Case-folded, stopword-filtered tokens from ``tokenize``.
 */
export const distinctiveAnchorTokens = (
  tokens: readonly string[],
): Set<string> => {
  const anchors = new Set<string>();
  for (const token of tokens) {
    if (token.length >= 4 || /^\d{2,}$/.test(token)) {
      anchors.add(token);
    }
  }

  return anchors;
};

/**
 * Collects every comparable figure in a text, normalized and prefixed by kind.
 *
 * - Important: a bare year cannot match. It carries no unit and no thousands separator, so it never
 *   contributes to a same-event decision.
 *
 * @param text - Any text to scan.
 */
export const extractFigures = (text: string): Set<string> => {
  const figures = new Set<string>();
  for (const { kind, pattern } of FIGURE_KINDS) {
    for (const match of String(text ?? "").matchAll(pattern)) {
      const digits = (match[1] ?? "")
        .replace(/[.,\s]/g, "")
        .replace(/^0+(?=\d)/, "");
      if (digits.length > 0) {
        figures.add(`${kind}:${digits}`);
      }
    }
  }

  return figures;
};

/**
 * Counts the members two sets share.
 *
 * @param left - First set.
 * @param right - Second set.
 */
export const sharedCount = (
  left: ReadonlySet<string>,
  right: ReadonlySet<string>,
): number => {
  const [smaller, larger] =
    left.size <= right.size ? [left, right] : [right, left];
  let shared = 0;
  for (const value of smaller) {
    if (larger.has(value)) {
      shared += 1;
    }
  }

  return shared;
};

/**
 * Share of the smaller set that the larger one also holds.
 *
 * - Important: containment rather than Jaccard, so a short text whose anchors are a subset of a
 *   longer one still matches. Jaccard under-scores that pair.
 *
 * @param left - First set.
 * @param right - Second set.
 */
export const containment = (
  left: ReadonlySet<string>,
  right: ReadonlySet<string>,
): number => {
  const smallest = Math.min(left.size, right.size);

  return smallest === 0 ? 0 : sharedCount(left, right) / smallest;
};
