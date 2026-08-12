const SCALE_WORDS =
  "triliun|trilyun|trillion|miliar|milyar|billion|juta|million|ribu|thousand|bn|mn|k";

const PERCENT_MARKERS = "%|(?:persen|percent|pct)\\b";

const CURRENCY_MARKERS = "rp|idr|usd|us\\$|\\$|eur|€|sgd|myr|jpy|¥|£|gbp";

const NUMBER = "\\d[\\d.,]*";

const PERCENT_FIGURE = new RegExp(
  `(${NUMBER})\\s*(?:${PERCENT_MARKERS})`,
  "gi",
);

const CURRENCY_FIGURE = new RegExp(
  `(?:${CURRENCY_MARKERS})\\s*(${NUMBER})`,
  "gi",
);

const SCALED_FIGURE = new RegExp(`(${NUMBER})\\s*(?:${SCALE_WORDS})\\b`, "gi");

const normalizeDigits = (raw: string): string =>
  raw.replace(/[.,\s]/g, "").replace(/^0+(?=\d)/, "");

const collect = (text: string, pattern: RegExp): Set<string> => {
  const found = new Set<string>();
  for (const match of text.matchAll(pattern)) {
    const digits = normalizeDigits(match[1] ?? "");
    if (digits.length > 0) {
      found.add(digits);
    }
  }

  return found;
};

export type FigureKind = "percent" | "currency" | "scaled";

export type UngroundedFigure = { kind: FigureKind; value: string };

const KINDS: { kind: FigureKind; pattern: RegExp }[] = [
  { kind: "percent", pattern: PERCENT_FIGURE },
  { kind: "currency", pattern: CURRENCY_FIGURE },
  { kind: "scaled", pattern: SCALED_FIGURE },
];

export const ungroundedFigures = (
  point: string,
  sourceText: string,
): UngroundedFigure[] => {
  const ungrounded: UngroundedFigure[] = [];

  for (const { kind, pattern } of KINDS) {
    const inPoint = collect(point, pattern);
    if (inPoint.size === 0) {
      continue;
    }
    const inSource = collect(sourceText, pattern);
    for (const value of inPoint) {
      if (!inSource.has(value)) {
        ungrounded.push({ kind, value });
      }
    }
  }

  return ungrounded;
};

export const figuresGrounded = (point: string, sourceText: string): boolean =>
  ungroundedFigures(point, sourceText).length === 0;

/**
 * Lists every figure a point asserts, with no source to check it against.
 *
 * - Important: for a source carrying only its collection-time description, there is no article
 *   text to ground against. The description is itself a short machine-written summary, so a figure
 *   matching it is not evidence the article reports that figure.
 *
 * @param point - One generated summary point.
 * @returns Every percent, currency, and scaled figure the point cites.
 */
export const citedFigures = (point: string): UngroundedFigure[] => {
  const cited: UngroundedFigure[] = [];

  for (const { kind, pattern } of KINDS) {
    for (const value of collect(point, pattern)) {
      cited.push({ kind, value });
    }
  }

  return cited;
};

/**
 * Digit runs written with thousands separators, such as `366,000` or `20.223`.
 *
 * Comparison only. Grounding uses {@link KINDS}, which requires a percent, currency or scale
 * marker, because an item should not be dropped over a bare count. Two stories sharing several
 * grouped quantities are the same story, which is what dedup needs and grounding does not.
 * Normalization strips separators, so an Indonesian `366.000` and an English `366,000` match.
 */
const GROUPED_FIGURE = /\b(\d{1,3}(?:[.,]\d{3})+)\b/g;

const COMPARISON_KINDS: { kind: string; pattern: RegExp }[] = [
  ...KINDS,
  { kind: "grouped", pattern: GROUPED_FIGURE },
];

/**
 * Collects every comparable figure in a text, normalized.
 *
 * Percent, currency, scaled and grouped digit runs are returned. A bare year cannot match: it
 * carries no unit and no thousands separator.
 *
 * @param text - Any text to scan.
 * @returns Normalized digit strings, prefixed by kind so a percent never matches a currency.
 */
export const extractFigures = (text: string): Set<string> => {
  const figures = new Set<string>();
  for (const { kind, pattern } of COMPARISON_KINDS) {
    for (const value of collect(text, pattern)) {
      figures.add(`${kind}:${value}`);
    }
  }

  return figures;
};

/**
 * Counts the unit-bearing figures two texts share.
 *
 * @param left - First text.
 * @param right - Second text.
 * @returns How many normalized figures appear in both.
 */
export const sharedFigureCount = (left: string, right: string): number => {
  const rightFigures = extractFigures(right);
  let shared = 0;
  for (const figure of extractFigures(left)) {
    if (rightFigures.has(figure)) {
      shared += 1;
    }
  }

  return shared;
};
