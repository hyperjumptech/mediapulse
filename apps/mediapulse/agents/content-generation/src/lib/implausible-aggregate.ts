/**
 * Phrases marking a figure as a country-wide or market-wide total rather than one party's number.
 *
 * The distinction carries the whole check. "Option transactions reached US$1.39 million" is a
 * component and perfectly plausible; "Bank Indonesia recorded foreign exchange market transactions
 * of US$87.11 million" is a national total and is not.
 */
const NATIONAL_AGGREGATE =
  /\b(?:bank\s+indonesia\s+(?:recorded|records|noted)|nationwide|national(?:ly)?\s+(?:total|volume|transactions?|turnover)|industry-wide|market\s+transactions?|national\s+banking|indonesia'?s?\s+(?:total|entire)\s+\w+|across\s+the\s+(?:banking|national)\s+\w+)\b/iu;

/** A period long enough that a national total cannot stay small. */
const MULTI_MONTH_PERIOD =
  /\b(?:first\s+(?:seven|six|five|four|three|two)\s+months|(?:half|h1|h2|1h|2h)\s*(?:of\s*)?20\d{2}|full\s+year|year[- ]to[- ]date|ytd|annually|per\s+year|first\s+half|second\s+half|throughout\s+20\d{2})\b/iu;

const USD_MILLIONS = /\b(?:us\$|usd|\$)\s?(\d[\d.,]*)\s*(million|mn|juta)\b/iu;

const IDR_BILLIONS = /\b(?:rp|idr)\s?(\d[\d.,]*)\s*(billion|miliar|milyar)\b/iu;

/**
 * Floors below which a multi-month Indonesian national aggregate is not a real number.
 *
 * Deliberately generous. Indonesia's banking system moves billions of dollars a day, so a
 * seven-month national total under US$1bn is wrong by orders of magnitude rather than by a margin,
 * and nothing legitimate sits near the line.
 */
const MIN_NATIONAL_USD_MILLIONS = 1_000;
const MIN_NATIONAL_IDR_BILLIONS = 10_000;

const toNumber = (raw: string): number =>
  Number(raw.replaceAll(/[.,](?=\d{3}\b)/gu, "").replace(",", "."));

/**
 * Reports whether a point states an Indonesian national aggregate too small to be real.
 *
 * This exists because grounding cannot catch a publisher's own unit error. On 2026-09-04 a NOBU
 * lead said Bank Indonesia recorded "US$87.11 million" of foreign exchange market transactions over
 * seven months, which is about US$620,000 a day for the entire banking system. Kontan printed
 * `juta`, so the summary was faithful to its source and the figure was still wrong by three orders
 * of magnitude.
 *
 * - Important: all three signals are required, an aggregate phrasing, a multi-month period, and a
 *   figure under the floor. A component figure, a single institution's figure, and a one-day figure
 *   are all left alone.
 *
 * @param point - One generated summary point.
 * @returns True when the point states an implausibly small national aggregate.
 */
export const statesImplausibleAggregate = (point: string): boolean => {
  if (!NATIONAL_AGGREGATE.test(point) || !MULTI_MONTH_PERIOD.test(point)) {
    return false;
  }

  const usd = USD_MILLIONS.exec(point);
  if (usd?.[1] !== undefined && toNumber(usd[1]) < MIN_NATIONAL_USD_MILLIONS) {
    return true;
  }
  const idr = IDR_BILLIONS.exec(point);

  return idr?.[1] !== undefined && toNumber(idr[1]) < MIN_NATIONAL_IDR_BILLIONS;
};
