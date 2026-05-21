const NON_ARTICLE_MARKERS = [
  "key statistics",
  "historical data",
  "financial summary",
  "company profile",
  "market cap",
  "consensus estimates",
  "quote summary",
  "earnings revisions",
] as const;

const BLOCKED_TITLES = [
  "Just a moment...",
  "Attention Required! | Cloudflare",
  "Access denied",
  "403 Forbidden",
  "Page Not Found",
] as const;

const SOFT_NOT_FOUND_PHRASES = [
  "page not found",
  "404 not found",
  "this page doesn't exist",
  "the page you requested could not be found",
] as const;

const ACCESS_GATED_PHRASES = [
  "subscribe to read",
  "subscribers only",
  "sign in to continue reading",
  "create a free account to continue",
  "log in to read",
  "enable cookies",
  "enable javascript",
] as const;

const MIN_CONTENT_LENGTH = 180;
const MAX_LINK_DENSITY = 0.08;
const MIN_TITLE_LENGTH = 12;
const MIN_WORD_COUNT = 80;
const SOFT_404_MAX_LENGTH = 1500;
const MIN_ALPHA_DENSITY = 0.55;
const REPETITION_SHINGLE_SIZE = 6;
const REPETITION_THRESHOLD = 0.2;

export type QualityDropReason =
  | "content_no_title"
  | "content_soft_404"
  | "content_access_gated"
  | "content_too_short"
  | "content_repetitive"
  | "content_link_farm"
  | "content_index_like";

export type QualityDecision =
  | { blocked: true; reason: QualityDropReason }
  | { blocked: false };

/** @deprecated Use {@link QualityDecision} */
export type ContentShapeDecision = QualityDecision;

type QualityRule = (
  title: string,
  content: string,
  url: string,
) => QualityDecision;

/**
 * Returns an empty counter map with one bucket per quality-gate drop reason.
 *
 * @returns Zeroed counters for all {@link QualityDropReason} values.
 */
export const createEmptyQualityCounters = (): Record<
  QualityDropReason,
  number
> => ({
  content_no_title: 0,
  content_soft_404: 0,
  content_access_gated: 0,
  content_too_short: 0,
  content_repetitive: 0,
  content_link_farm: 0,
  content_index_like: 0,
});

/**
 * Returns whether `haystack` contains any phrase from `needles` (case-insensitive).
 *
 * @param haystack - Text to search.
 * @param needles - Phrases to look for.
 */
const includesAnyPhrase = (
  haystack: string,
  needles: readonly string[],
): boolean => {
  const lowerHaystack = haystack.toLowerCase();
  return needles.some((needle) => lowerHaystack.includes(needle.toLowerCase()));
};

/**
 * Computes the ratio of alphabetic characters to total characters.
 *
 * @param text - Input text.
 */
const computeAlphaDensity = (text: string): number => {
  if (text.length === 0) {
    return 0;
  }
  const alphaCount = (text.match(/[a-zA-Z]/g) ?? []).length;
  return alphaCount / text.length;
};

/**
 * Returns the largest share of identical n-word shingles in `content`.
 *
 * @param content - Body text to analyze.
 * @param n - Shingle width in words (default 6).
 */
export const maxShingleFraction = (
  content: string,
  n = REPETITION_SHINGLE_SIZE,
): number => {
  const words = content.split(/\s+/).filter(Boolean);
  if (words.length < n) {
    return 0;
  }

  const counts = new Map<string, number>();
  for (let index = 0; index <= words.length - n; index += 1) {
    const shingle = words
      .slice(index, index + n)
      .join(" ")
      .toLowerCase();
    counts.set(shingle, (counts.get(shingle) ?? 0) + 1);
  }

  const totalShingles = words.length - n + 1;
  let maxCount = 0;
  for (const count of counts.values()) {
    if (count > maxCount) {
      maxCount = count;
    }
  }

  return maxCount / totalShingles;
};

/**
 * Blocks pages with missing, too-short, or known challenge-page titles.
 *
 * @param title - Page title.
 */
const titleEmptyOrTooShort = (title: string): QualityDecision => {
  const trimmed = title.trim();
  const normalizedTitle = trimmed.toLowerCase();
  const matchesBlockedTitle = BLOCKED_TITLES.some(
    (blocked) => blocked.toLowerCase() === normalizedTitle,
  );

  if (trimmed.length < MIN_TITLE_LENGTH || matchesBlockedTitle) {
    return { blocked: true, reason: "content_no_title" };
  }

  return { blocked: false };
};

/**
 * Blocks soft-404 pages that mention missing content in a short body.
 *
 * @param _title - Unused; kept for rule-chain signature consistency.
 * @param content - Fetched page body.
 */
const softNotFound = (_title: string, content: string): QualityDecision => {
  const normalized = content.trim();
  if (
    normalized.length < SOFT_404_MAX_LENGTH &&
    includesAnyPhrase(normalized, SOFT_NOT_FOUND_PHRASES)
  ) {
    return { blocked: true, reason: "content_soft_404" };
  }

  return { blocked: false };
};

/**
 * Blocks paywall, login, and cookie-wall stubs with thin prose density.
 *
 * @param _title - Unused; kept for rule-chain signature consistency.
 * @param content - Fetched page body.
 */
const accessGated = (_title: string, content: string): QualityDecision => {
  const normalized = content.trim();
  if (
    includesAnyPhrase(normalized, ACCESS_GATED_PHRASES) &&
    computeAlphaDensity(normalized) < MIN_ALPHA_DENSITY
  ) {
    return { blocked: true, reason: "content_access_gated" };
  }

  return { blocked: false };
};

/**
 * Blocks bodies with fewer than the minimum word count.
 *
 * @param _title - Unused; kept for rule-chain signature consistency.
 * @param content - Fetched page body.
 */
const minProse = (_title: string, content: string): QualityDecision => {
  const wordCount = content.trim().split(/\s+/).filter(Boolean).length;

  if (wordCount < MIN_WORD_COUNT) {
    return { blocked: true, reason: "content_too_short" };
  }

  return { blocked: false };
};

/**
 * Blocks nav-heavy pages where one phrase repeats across most shingles.
 *
 * @param _title - Unused; kept for rule-chain signature consistency.
 * @param content - Fetched page body.
 */
const repetitiveBoilerplate = (
  _title: string,
  content: string,
): QualityDecision => {
  if (maxShingleFraction(content) > REPETITION_THRESHOLD) {
    return { blocked: true, reason: "content_repetitive" };
  }

  return { blocked: false };
};

/**
 * Blocks link-farm pages with high outbound-link density.
 *
 * @param _title - Unused; kept for rule-chain signature consistency.
 * @param content - Fetched page body.
 */
const linkFarm = (_title: string, content: string): QualityDecision => {
  const normalized = content.trim();
  const words = normalized.split(/\s+/).filter(Boolean).length;
  const links = (normalized.match(/https?:\/\/|www\./gi) ?? []).length;
  const linkDensity = words === 0 ? 0 : links / words;

  if (linkDensity > MAX_LINK_DENSITY) {
    return { blocked: true, reason: "content_link_farm" };
  }

  return { blocked: false };
};

/**
 * Blocks index-like financial summary pages using marker heuristics.
 *
 * @param title - Page title.
 * @param content - Fetched page body.
 */
const indexLike = (title: string, content: string): QualityDecision => {
  const normalized = content.trim();
  const haystack = `${title}\n${normalized}`.toLowerCase();
  const markerHits = NON_ARTICLE_MARKERS.filter((marker) =>
    haystack.includes(marker),
  ).length;

  if (markerHits >= 2 && normalized.length >= MIN_CONTENT_LENGTH) {
    return { blocked: true, reason: "content_index_like" };
  }

  if (markerHits >= 1 && normalized.length < MIN_CONTENT_LENGTH) {
    return { blocked: true, reason: "content_index_like" };
  }

  return { blocked: false };
};

const qualityRules: QualityRule[] = [
  (title) => titleEmptyOrTooShort(title),
  softNotFound,
  accessGated,
  minProse,
  repetitiveBoilerplate,
  linkFarm,
  indexLike,
];

/**
 * Runs the content quality gate rule chain; the first matching rule wins.
 *
 * @param title - Page title.
 * @param content - Fetched page body.
 * @param url - Canonical page URL (reserved for future host-specific rules).
 * @returns Decision indicating whether content should be excluded before persistence.
 */
export const runQualityGate = (
  title: string,
  content: string,
  url = "",
): QualityDecision => {
  for (const rule of qualityRules) {
    const decision = rule(title, content, url);
    if (decision.blocked) {
      return decision;
    }
  }

  return { blocked: false };
};

/**
 * Alias for {@link runQualityGate} retained for callers migrating from the shape filter.
 *
 * @param title - Page title.
 * @param content - Fetched page body.
 */
export const classifyNonArticleContent = runQualityGate;
