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
