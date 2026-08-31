import { existsSync, readFileSync, writeFileSync } from "node:fs";

const CACHE_PATH = new URL("../corpus/fx.json", import.meta.url).pathname;

type RateCache = Record<string, number>;

const loadCache = (): RateCache =>
  existsSync(CACHE_PATH)
    ? (JSON.parse(readFileSync(CACHE_PATH, "utf8")) as RateCache)
    : {};

const saveCache = (cache: RateCache): void => {
  writeFileSync(CACHE_PATH, `${JSON.stringify(cache, null, 2)}\n`);
};

export const reportingPeriodEnd = (publishedAt: Date): string => {
  const year = publishedAt.getUTCFullYear();
  const quarterEnds = [
    Date.UTC(year, 2, 31),
    Date.UTC(year, 5, 30),
    Date.UTC(year, 8, 30),
    Date.UTC(year, 11, 31),
  ];
  const previousYearEnd = Date.UTC(year - 1, 11, 31);
  const candidates = [previousYearEnd, ...quarterEnds].filter(
    (candidate) => candidate < publishedAt.getTime(),
  );
  const chosen = candidates[candidates.length - 1] ?? previousYearEnd;

  return new Date(chosen).toISOString().slice(0, 10);
};

export const usdIdrRate = async (date: string): Promise<number | null> => {
  const cache = loadCache();
  const cached = cache[date];
  if (typeof cached === "number") {
    return cached;
  }

  const response = await fetch(
    `https://api.frankfurter.dev/v1/${date}?base=USD&symbols=IDR`,
  );
  if (!response.ok) {
    return null;
  }
  const payload = (await response.json()) as { rates?: { IDR?: number } };
  const rate = payload.rates?.IDR;
  if (typeof rate !== "number") {
    return null;
  }
  cache[date] = rate;
  saveCache(cache);

  return rate;
};

export const referenceRateBlock = (rate: number, date: string): string => {
  const formattedDate = new Date(`${date}T00:00:00Z`).toLocaleDateString(
    "en-GB",
    { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" },
  );

  return `\n\nReference rate: ${rate.toLocaleString("en-US")} IDR per USD as of ${formattedDate}.`;
};
