/** Metadata fields from a fetch provider response used for publication-date extraction. */
export type FetchMetadata = {
  publishedTime?: string;
  published_at?: string;
  usage?: { tokens?: number };
};

/** @deprecated Use {@link FetchMetadata} instead. */
export type JinaFetchMetadata = FetchMetadata;

export type ExtractPublishedDateInput = {
  fetchMetadata?: FetchMetadata;
  /** @deprecated Use {@link ExtractPublishedDateInput.fetchMetadata} instead. */
  jinaMetadata?: FetchMetadata;
  content: string;
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MAX_AGE_YEARS = 10;
const HEAD_SCAN_CHARS = 4_000;

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
    return parseInSanityRange(isoMatch[1], now);
  }

  return null;
};

/**
 * Extracts the best-effort publication date from fetch metadata and page content.
 *
 * @param input - Fetch metadata and fetched content.
 * @param now - Reference time for sanity-range validation.
 * @returns Parsed publication date, or `null` when no reliable signal is found.
 */
export const extractPublishedDate = (
  input: ExtractPublishedDateInput,
  now: Date = new Date(),
): Date | null => {
  const metadata = input.fetchMetadata ?? input.jinaMetadata;
  const fromMetadata = extractFromFetchMetadata(metadata, now);
  if (fromMetadata) {
    return fromMetadata;
  }

  return extractFromContent(input.content, now);
};
