/** Metadata fields from a fetch provider response used for publication-date extraction. */
export type FetchMetadata = {
  publishedTime?: string;
  published_at?: string;
  usage?: { tokens?: number };
};

export type ExtractPublishedDateInput = {
  fetchMetadata?: FetchMetadata;
  content: string;
  url?: string;
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MAX_AGE_YEARS = 10;
const HEAD_SCAN_CHARS = 4_000;

const URL_DATE_YMD = /\/(\d{4})\/(\d{2})\/(\d{2})(?=\/|$|[?#-])/;
const URL_DATE_YM = /\/(\d{4})\/(\d{2})(?=\/|$|[?#])/;
const URL_DATE_COMPACT = /\/(20\d{2})([01]\d)([0-3]\d)/;

const MONTHS_BY_NAME = new Map<string, number>([
  ["januari", 1],
  ["january", 1],
  ["februari", 2],
  ["february", 2],
  ["maret", 3],
  ["march", 3],
  ["april", 4],
  ["mei", 5],
  ["may", 5],
  ["juni", 6],
  ["june", 6],
  ["juli", 7],
  ["july", 7],
  ["agustus", 8],
  ["august", 8],
  ["september", 9],
  ["oktober", 10],
  ["october", 10],
  ["november", 11],
  ["desember", 12],
  ["december", 12],
]);

const MONTH_NAMES = [...MONTHS_BY_NAME.keys()].join("|");

const DAY_MONTH_YEAR = new RegExp(
  `\\b(\\d{1,2})\\s+(${MONTH_NAMES})\\.?\\s+(\\d{4})\\b`,
  "i",
);

const MONTH_DAY_YEAR = new RegExp(
  `\\b(${MONTH_NAMES})\\.?\\s+(\\d{1,2}),\\s*(\\d{4})\\b`,
  "i",
);

const pad = (value: number): string => String(value).padStart(2, "0");

const JSON_LD_DATE_PUBLISHED = /"datePublished"\s*:\s*"([^"]+)"/i;
const META_ARTICLE_PUBLISHED_TIME =
  /<meta\s+[^>]*property=["']article:published_time["'][^>]*content=["']([^"']+)["']/i;
const META_ARTICLE_PUBLISHED_TIME_REVERSED =
  /<meta\s+[^>]*content=["']([^"']+)["'][^>]*property=["']article:published_time["']/i;
const ISO_DATE_IN_TEXT =
  /\b(\d{4}-\d{2}-\d{2}(?:[T\s]\d{2}:\d{2}(?::\d{2})?(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?)?)\b/;

/**
 * Parses a date string when it falls within the sanity window.
 *
 * @param value - Raw date string from metadata or content.
 * @param now - Reference time for range validation.
 */
const parseInSanityRange = (value: string, now: Date): Date | null => {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  const minDate = new Date(now.getTime() - MAX_AGE_YEARS * 365.25 * MS_PER_DAY);
  const maxDate = new Date(now.getTime() + MAX_AGE_YEARS * 365.25 * MS_PER_DAY);

  if (parsed < minDate || parsed > maxDate) {
    return null;
  }

  return parsed;
};

/**
 * Reads explicit publication timestamps from fetch provider metadata.
 *
 * @param metadata - Optional fetch metadata object.
 * @param now - Reference time for range validation.
 */
const extractFromFetchMetadata = (
  metadata: FetchMetadata | undefined,
  now: Date,
): Date | null => {
  if (!metadata) {
    return null;
  }

  const candidates = [metadata.publishedTime, metadata.published_at].filter(
    (value): value is string => typeof value === "string" && value.length > 0,
  );

  for (const candidate of candidates) {
    const parsed = parseInSanityRange(candidate, now);
    if (parsed) {
      return parsed;
    }
  }

  return null;
};

/**
 * Scans fetched HTML/text for common publication-date signals.
 *
 * @param content - Full page body from Jina.
 * @param now - Reference time for range validation.
 */
const extractFromContent = (content: string, now: Date): Date | null => {
  const head = content.slice(0, HEAD_SCAN_CHARS);

  const jsonLdMatch = head.match(JSON_LD_DATE_PUBLISHED);
  if (jsonLdMatch?.[1]) {
    const parsed = parseInSanityRange(jsonLdMatch[1], now);
    if (parsed) {
      return parsed;
    }
  }

  const metaMatch =
    head.match(META_ARTICLE_PUBLISHED_TIME) ??
    head.match(META_ARTICLE_PUBLISHED_TIME_REVERSED);
  if (metaMatch?.[1]) {
    const parsed = parseInSanityRange(metaMatch[1], now);
    if (parsed) {
      return parsed;
    }
  }

  const isoMatch = head.match(ISO_DATE_IN_TEXT);
  if (isoMatch?.[1]) {
    const parsed = parseInSanityRange(isoMatch[1], now);
    if (parsed) {
      return parsed;
    }
  }

  const dayFirst = head.match(DAY_MONTH_YEAR);
  if (dayFirst) {
    const month = MONTHS_BY_NAME.get(dayFirst[2]!.toLowerCase());
    if (month !== undefined) {
      const parsed = parseInSanityRange(
        `${dayFirst[3]!}-${pad(month)}-${pad(Number(dayFirst[1]))}`,
        now,
      );
      if (parsed) {
        return parsed;
      }
    }
  }

  const monthFirst = head.match(MONTH_DAY_YEAR);
  if (monthFirst) {
    const month = MONTHS_BY_NAME.get(monthFirst[1]!.toLowerCase());
    if (month !== undefined) {
      return parseInSanityRange(
        `${monthFirst[3]!}-${pad(month)}-${pad(Number(monthFirst[2]))}`,
        now,
      );
    }
  }

  return null;
};

/**
 * Extracts a publication date from a `/YYYY/MM/DD/` or `/YYYY/MM/` slug in the URL path.
 *
 * @param url - The source URL.
 * @param now - Reference time for sanity-range validation.
 * @returns Parsed publication date, or `null` when the path carries no valid date.
 */
export const extractDateFromUrl = (
  url: string,
  now: Date = new Date(),
): Date | null => {
  const ymd = url.match(URL_DATE_YMD);
  if (ymd) {
    const parsed = parseInSanityRange(`${ymd[1]}-${ymd[2]}-${ymd[3]}`, now);
    if (parsed) {
      return parsed;
    }
  }

  const ym = url.match(URL_DATE_YM);
  if (ym) {
    const parsed = parseInSanityRange(`${ym[1]}-${ym[2]}-01`, now);
    if (parsed) {
      return parsed;
    }
  }

  const compact = url.match(URL_DATE_COMPACT);
  if (compact) {
    return parseInSanityRange(`${compact[1]}-${compact[2]}-${compact[3]}`, now);
  }

  return null;
};

/**
 * Extracts the best-effort publication date from fetch metadata, page content, and the URL slug.
 *
 * @param input - Fetch metadata, fetched content, and the source URL.
 * @param now - Reference time for sanity-range validation.
 * @returns Parsed publication date, or `null` when no reliable signal is found.
 */
export const extractPublishedDate = (
  input: ExtractPublishedDateInput,
  now: Date = new Date(),
): Date | null => {
  const fromMetadata = extractFromFetchMetadata(input.fetchMetadata, now);
  if (fromMetadata) {
    return fromMetadata;
  }

  const fromContent = extractFromContent(input.content, now);
  if (fromContent) {
    return fromContent;
  }

  return input.url ? extractDateFromUrl(input.url, now) : null;
};
