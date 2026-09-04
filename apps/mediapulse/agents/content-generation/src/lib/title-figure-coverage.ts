/**
 * Number words a heading's figure may be written out as in a point, as in a heading saying
 * "5 Insurance Companies" over a point saying "Five insurance companies". Without these the
 * coverage check reads a spelled-out figure as a missing one.
 */
const NUMBER_WORDS: ReadonlyMap<string, string> = new Map([
  ["one", "1"],
  ["satu", "1"],
  ["two", "2"],
  ["dua", "2"],
  ["three", "3"],
  ["tiga", "3"],
  ["four", "4"],
  ["empat", "4"],
  ["five", "5"],
  ["lima", "5"],
  ["six", "6"],
  ["enam", "6"],
  ["seven", "7"],
  ["tujuh", "7"],
  ["eight", "8"],
  ["delapan", "8"],
  ["nine", "9"],
  ["sembilan", "9"],
  ["ten", "10"],
  ["sepuluh", "10"],
  ["eleven", "11"],
  ["twelve", "12"],
  ["dozen", "12"],
  ["twice", "2"],
  ["double", "2"],
  ["doubled", "2"],
  ["triple", "3"],
  ["tripled", "3"],
  ["quadruple", "4"],
]);

const MONTH_NAMES =
  "january|february|march|april|may|june|july|august|september|october|november|december|januari|februari|maret|mei|juni|juli|agustus|oktober|desember";

/**
 * Currency written flush against its amount, as in `Rp300`. A space is inserted so the amount is
 * not read as part of a word and discarded by {@link FIGURE}.
 */
const CURRENCY_PREFIX = /\b(rp|idr|usd|us\$|sgd|myr|eur|gbp|jpy)(?=\d)/giu;

/**
 * A digit run that is not welded to a letter on either side.
 *
 * The lookaround discards a product or period name rather than a quantity: `5G` and `4G` fail the
 * lookahead, `H1` and `Q2` fail the lookbehind. Both would otherwise enter the heading's figure set
 * and demand coverage no point could give. The lookahead bars a digit as well as a letter, so an
 * ordinal like `81st` cannot backtrack and match its leading `8`.
 */
const FIGURE = /(?<![\p{L}\d])\d[\d.,]*(?![\p{L}\d])/gu;

const YEAR = /^(?:19|20)\d{2}$/u;

const normalizeDigits = (raw: string): string =>
  raw.replaceAll(/[.,\s]/gu, "").replace(/^0+(?=\d)/u, "");

/**
 * Reports whether a figure at this position is a calendar date rather than a quantity.
 *
 * Three shapes: a day preceded by its month ("September 4"), a day followed by its month
 * ("4 September"), and a day followed by its year ("4, 2026"). All appear in headings announcing
 * when something starts, and none is a number a point owes the reader.
 *
 * @param text - The heading being scanned.
 * @param start - Index the figure starts at.
 * @param length - Length of the matched figure.
 */
const isCalendarDate = (
  text: string,
  start: number,
  length: number,
): boolean => {
  const before = text.slice(0, start);
  const after = text.slice(start + length);

  return (
    new RegExp(`(?:${MONTH_NAMES})\\s+$`, "iu").test(before) ||
    new RegExp(`^\\s+(?:${MONTH_NAMES})\\b`, "iu").test(after) ||
    /^,?\s*(?:19|20)\d{2}\b/u.test(after)
  );
};

/**
 * Figures a heading commits to, normalized to digit strings.
 *
 * A four-digit year and a calendar date are excluded: neither is a claim, and demanding a point
 * repeat them would drop good articles.
 *
 * @param title - The article's translated heading.
 * @returns Normalized digit strings the heading asserts.
 */
export const headingFigures = (title: string): Set<string> => {
  const spaced = title.replaceAll(CURRENCY_PREFIX, "$1 ");
  const figures = new Set<string>();
  for (const match of spaced.matchAll(FIGURE)) {
    const raw = match[0].replace(/[.,]+$/u, "");
    if (
      YEAR.test(raw) ||
      isCalendarDate(spaced, match.index, match[0].length)
    ) {
      continue;
    }
    const digits = normalizeDigits(raw);
    if (digits.length > 0) {
      figures.add(digits);
    }
  }

  return figures;
};

/**
 * Figures the points carry, in digits and spelled out.
 *
 * @param points - The sanitized, grounded summary points.
 * @returns Normalized digit strings the points state.
 */
const pointFigures = (points: readonly string[]): Set<string> => {
  const text = points.join(" ");
  const spaced = text.replaceAll(CURRENCY_PREFIX, "$1 ");
  const figures = new Set<string>();
  for (const match of spaced.matchAll(FIGURE)) {
    const digits = normalizeDigits(match[0].replace(/[.,]+$/u, ""));
    if (digits.length > 0) {
      figures.add(digits);
    }
  }
  for (const word of text.toLowerCase().split(/[^\p{L}]+/u)) {
    const digit = NUMBER_WORDS.get(word);
    if (digit !== undefined) {
      figures.add(digit);
    }
  }

  return figures;
};

/**
 * Reports whether a point's figure states a heading's figure at equal or finer precision.
 *
 * A heading rounds, and it rounds in both directions: "+2%" over a point saying "2.58%", and "757%"
 * over a point saying "756.7%". Truncating the point's digits to the heading's length answers the
 * first, and allowing the truncation plus one answers the second.
 *
 * @param stated - A normalized figure one of the points carries.
 * @param heading - A normalized figure the heading asserts.
 */
const statesFigure = (stated: string, heading: string): boolean => {
  if (stated === heading || stated.startsWith(heading)) {
    return true;
  }
  if (stated.length <= heading.length) {
    return false;
  }
  const truncated = Number(stated.slice(0, heading.length));

  return String(truncated + 1) === heading;
};

/**
 * Lists a heading's figures when no point states any of them.
 *
 * One covered figure is enough. A dense heading naming several numbers is honoured by an item that
 * evidences one of them, and demanding all of them would drop sound articles: "BI Records Primary
 * Money Growth of 17.1% to Rp 2,254.5 Trillion" over a point stating the 17.1% is a fair item. What
 * is never fair is a heading built on a number the item never mentions at all, as in "Vale Prepares
 * to Operate 3 HPAL Nickel Smelters" over a single point about downstreaming.
 *
 * A figure counts as stated when a point gives it at equal or finer precision, so a heading rounding
 * "+2%" is answered by a point saying "2.58%", and "757%" by "756.7%".
 *
 * @param title - The article's translated heading.
 * @param points - The sanitized, grounded summary points.
 * @returns The heading's figures when none is evidenced, otherwise empty.
 */
export const titleFiguresMissingFromPoints = (
  title: string,
  points: readonly string[],
): string[] => {
  const heading = headingFigures(title);
  if (heading.size === 0 || points.length === 0) {
    return [];
  }
  const stated = pointFigures(points);
  const evidenced = [...heading].some((figure) =>
    [...stated].some((value) => statesFigure(value, figure)),
  );

  return evidenced ? [] : [...heading];
};
