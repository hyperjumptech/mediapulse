const MONTHS: ReadonlyMap<string, number> = new Map([
  ["january", 0],
  ["januari", 0],
  ["february", 1],
  ["februari", 1],
  ["march", 2],
  ["maret", 2],
  ["april", 3],
  ["may", 4],
  ["mei", 4],
  ["june", 5],
  ["juni", 5],
  ["july", 6],
  ["juli", 6],
  ["august", 7],
  ["agustus", 7],
  ["september", 8],
  ["october", 9],
  ["oktober", 9],
  ["november", 10],
  ["december", 11],
  ["desember", 11],
]);

const MONTH_NAMES = [...MONTHS.keys()].join("|");

/** "29 August 2026" and "29 Agustus 2026". */
const DAY_MONTH_YEAR = new RegExp(
  `\\b(\\d{1,2})\\s+(${MONTH_NAMES})\\s+(\\d{4})\\b`,
  "iu",
);

/** "August 29, 2026" and "August 29 2026". */
const MONTH_DAY_YEAR = new RegExp(
  `\\b(${MONTH_NAMES})\\s+(\\d{1,2}),?\\s+(\\d{4})\\b`,
  "iu",
);

/**
 * A quoted level rather than a development: a price, a rate, or an index reading.
 *
 * These are the claims whose value expires with the trading day. An article publishing today about a
 * price quoted a week ago is fresh by its own timestamp and stale in the only way that matters to a
 * reader, which is what the per-section age windows cannot see. On 2026-09-04 an ANTM issue carried
 * "Antam Gold Price at Pegadaian August 29, 2026" as a Quick Hit.
 */
const QUOTED_LEVEL =
  /\b(?:harga|price|prices|kurs|exchange\s+rate|suku\s+bunga|interest\s+rate|yield|index|indeks|ihsg|closing|penutupan)\b/iu;

/**
 * The date a headline quotes its figure as of, when it quotes one.
 *
 * Returns a date only for a headline that both states a level and dates it. A headline dating a
 * development ("Buyback Starting September 4, 2026") states no level and is left alone, and a
 * headline quoting a level without a date carries no claim date to use.
 *
 * @param title - The article's title.
 * @returns The quoted date at UTC midnight, or `null`.
 */
export const quotedLevelDate = (title: string): Date | null => {
  if (!QUOTED_LEVEL.test(title)) {
    return null;
  }

  const dayFirst = DAY_MONTH_YEAR.exec(title);
  if (dayFirst !== null) {
    return buildDate(dayFirst[3], dayFirst[2], dayFirst[1]);
  }
  const monthFirst = MONTH_DAY_YEAR.exec(title);
  if (monthFirst !== null) {
    return buildDate(monthFirst[3], monthFirst[1], monthFirst[2]);
  }

  return null;
};

const buildDate = (
  year: string | undefined,
  month: string | undefined,
  day: string | undefined,
): Date | null => {
  const monthIndex = MONTHS.get((month ?? "").toLowerCase());
  if (monthIndex === undefined || year === undefined || day === undefined) {
    return null;
  }

  return new Date(Date.UTC(Number(year), monthIndex, Number(day)));
};
