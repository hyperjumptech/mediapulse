const MONTH_WORDS = [
  "januari",
  "februari",
  "maret",
  "april",
  "mei",
  "juni",
  "juli",
  "agustus",
  "september",
  "oktober",
  "november",
  "desember",
  "january",
  "february",
  "march",
  "may",
  "june",
  "july",
  "august",
  "october",
  "december",
].join("|");

const DAY_AND_MONTH = new RegExp(`\\b\\d{1,2}\\s+(?:${MONTH_WORDS})\\b`, "iu");

const MONTH_AND_YEAR = new RegExp(`\\b(?:${MONTH_WORDS})\\s+\\d{4}\\b`, "iu");

const QUARTER =
  /\b(?:q[1-4]|kuartal\s+(?:i{1,3}v?|[1-4])|semester\s+(?:i{1,2}|[12]))\b/iu;

const EMBEDDED_FIGURE =
  /(?<!\p{N})\d+(?:[.,]\d+)?\s*(?:%|(?:persen|percent|triliun|trilyun|miliar|milyar|juta|trillion|billion|million)\b)/iu;

const ONE_OFF_EVENT =
  /\b(?:hut\s+ri|hari\s+kemerdekaan|independence\s+day|idul\s+fitri|lebaran|natal|tahun\s+baru|harbolnas|black\s+friday|ramadan|ramadhan)\b/iu;

/** Why a generated query was refused before it could reach a persisted set. */
export type PerishableReason = "dated" | "embedded_figure" | "one_off_event";

/**
 * Reports why a query will stop returning results, or null when it should keep working.
 *
 * A query is refused when it names a calendar point, carries a figure it is searching for, or is
 * tied to a single-day event. Each decays to zero yield within days of being written, and a query
 * that already contains its own answer can only re-find the story that answer came from.
 *
 * @param text - Generated query text.
 * @returns The reason the query perishes, or null when it does not.
 */
export const perishableReason = (text: string): PerishableReason | null => {
  if (
    DAY_AND_MONTH.test(text) ||
    MONTH_AND_YEAR.test(text) ||
    QUARTER.test(text)
  ) {
    return "dated";
  }
  if (ONE_OFF_EVENT.test(text)) {
    return "one_off_event";
  }
  if (EMBEDDED_FIGURE.test(text)) {
    return "embedded_figure";
  }

  return null;
};

export const isPerishableQuery = (text: string): boolean =>
  perishableReason(text) !== null;
