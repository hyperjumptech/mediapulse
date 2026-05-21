import { classifyNoisyUrl } from "@workspace/utils";

const NON_ARTICLE_TITLE_MARKERS = [
  "key statistics",
  "historical data",
  "financial summary",
  "company profile",
  "consensus estimates",
] as const;

const BLOCKED_TITLES = [
  "just a moment...",
  "attention required! | cloudflare",
  "access denied",
  "403 forbidden",
  "page not found",
  "are you a robot",
] as const;

const SOFT_NOT_FOUND_PHRASES = [
  "page not found",
  "404 not found",
  "this page doesn't exist",
  "the page you requested could not be found",
  "we can't find that page",
] as const;

const ACCESS_GATED_PHRASES = [
  "subscribe to read",
  "subscribers only",
  "sign in to continue reading",
  "create a free account to continue",
  "log in to read",
  "enable cookies",
  "enable javascript",
  "please disable your ad blocker",
] as const;

const MIN_TITLE_LENGTH = 12;
const MIN_WORD_COUNT = 120;
const SOFT_404_MAX_LENGTH = 1500;
const MIN_ALPHA_DENSITY = 0.55;
const REPETITION_SHINGLE_SIZE = 6;
const REPETITION_THRESHOLD = 0.18;

export type QualityDropReason =
  | "prefilter_blocked_host"
  | "prefilter_blocked_path"
  | "prefilter_index_title"
  | "content_no_title"
  | "content_soft_404"
  | "content_access_gated"
  | "content_too_short"
  | "content_repetitive";

/** @deprecated Use {@link QualityDropReason} */
export type NonArticleReason = QualityDropReason;

export type QualityDecision =
  | { blocked: true; reason: QualityDropReason }
  | { blocked: false };

type QualityRuleContext = {
  url: string;
  title: string;
  content: string;
};

type QualityRule = (ctx: QualityRuleContext) => QualityDecision;

/**
 * Returns an empty counter map with one bucket per quality-gate drop reason.
 *
 * @returns Zeroed counters for all {@link QualityDropReason} values.
 */
export const createEmptyQualityCounters = (): Record<
  QualityDropReason,
  number
> => ({
  prefilter_blocked_host: 0,
  prefilter_blocked_path: 0,
  prefilter_index_title: 0,
  content_no_title: 0,
  content_soft_404: 0,
  content_access_gated: 0,
  content_too_short: 0,
  content_repetitive: 0,
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
 * Strips URLs and collapses whitespace for prose-density checks.
 *
 * @param content - Raw page body.
 */
const normalizeProseContent = (content: string): string =>
  content
    .replace(/https?:\/\/[^\s]+/gi, " ")
    .replace(/www\.[^\s]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

/**
 * Returns the largest share of identical n-word shingles in `content`.
 *
 * @param content - Body text to analyze.
 * @param n - Shingle width in words (default 6).
 */
export const countRepeatedShingles = (
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
 * @param ctx - URL, title, and content under test.
 */
const titleEmptyOrTooShort = (ctx: QualityRuleContext): QualityDecision => {
  const trimmed = ctx.title.trim();
  const normalizedTitle = trimmed.toLowerCase();
  const matchesBlockedTitle = BLOCKED_TITLES.some(
    (blocked) => blocked === normalizedTitle,
  );

  if (trimmed.length < MIN_TITLE_LENGTH || matchesBlockedTitle) {
    return { blocked: true, reason: "content_no_title" };
  }

  return { blocked: false };
};

/**
 * Blocks known non-article hosts and URL path patterns.
 *
 * @param ctx - URL, title, and content under test.
 */
const blockedUrl = (ctx: QualityRuleContext): QualityDecision => {
  try {
    new URL(ctx.url);
  } catch {
    return { blocked: false };
  }

  const urlDecision = classifyNoisyUrl(ctx.url);
  if (!urlDecision.blocked) {
    return { blocked: false };
  }

  if (urlDecision.reason === "blocked_host") {
    return { blocked: true, reason: "prefilter_blocked_host" };
  }

  return { blocked: true, reason: "prefilter_blocked_path" };
};

/**
 * Blocks index-like financial summary titles.
 *
 * @param ctx - URL, title, and content under test.
 */
const indexLikeTitle = (ctx: QualityRuleContext): QualityDecision => {
  const titleLower = ctx.title.toLowerCase();
  if (
    NON_ARTICLE_TITLE_MARKERS.some((marker) => titleLower.includes(marker))
  ) {
    return { blocked: true, reason: "prefilter_index_title" };
  }

  return { blocked: false };
};

/**
 * Blocks soft-404 pages that mention missing content in a short body.
 *
 * @param ctx - URL, title, and content under test.
 */
const softNotFound = (ctx: QualityRuleContext): QualityDecision => {
  const normalized = ctx.content.trim();
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
 * @param ctx - URL, title, and content under test.
 */
const accessGated = (ctx: QualityRuleContext): QualityDecision => {
  const normalized = ctx.content.trim();
  if (
    includesAnyPhrase(normalized, ACCESS_GATED_PHRASES) &&
    computeAlphaDensity(normalized) < MIN_ALPHA_DENSITY
  ) {
    return { blocked: true, reason: "content_access_gated" };
  }

  return { blocked: false };
};

/**
 * Blocks bodies with fewer than the minimum word count after URL stripping.
 *
 * @param ctx - URL, title, and content under test.
 */
const proseDensity = (ctx: QualityRuleContext): QualityDecision => {
  const normalized = normalizeProseContent(ctx.content);
  const wordCount = normalized.split(/\s+/).filter(Boolean).length;

  if (wordCount < MIN_WORD_COUNT) {
    return { blocked: true, reason: "content_too_short" };
  }

  return { blocked: false };
};

/**
 * Blocks nav-heavy pages where one phrase repeats across most shingles.
 *
 * @param ctx - URL, title, and content under test.
 */
const repetitiveBoilerplate = (ctx: QualityRuleContext): QualityDecision => {
  if (countRepeatedShingles(ctx.content) > REPETITION_THRESHOLD) {
    return { blocked: true, reason: "content_repetitive" };
  }

  return { blocked: false };
};

const qualityRules: QualityRule[] = [
  titleEmptyOrTooShort,
  blockedUrl,
  indexLikeTitle,
  softNotFound,
  accessGated,
  proseDensity,
  repetitiveBoilerplate,
];

/**
 * Runs the article quality gate rule chain; the first matching rule wins.
 *
 * @param url - Data source URL.
 * @param title - Source title.
 * @param content - Source body (raw, not truncated for LLM).
 * @returns Decision indicating whether the source should skip LLM extraction.
 */
export const runArticleQualityGate = (
  url: string,
  title: string,
  content: string,
): QualityDecision => {
  const ctx: QualityRuleContext = { url, title, content };

  for (const rule of qualityRules) {
    const decision = rule(ctx);
    if (decision.blocked) {
      return decision;
    }
  }

  return { blocked: false };
};

/**
 * Classifies whether a source is clearly non-article before running extraction.
 *
 * @param sourceUrl - Data source URL.
 * @param sourceTitle - Source title.
 * @param sourceContent - Source content.
 * @returns Null for likely article content, otherwise a concrete drop reason.
 */
export const classifyNonArticleSource = (
  sourceUrl: string,
  sourceTitle: string,
  sourceContent: string,
): QualityDropReason | null => {
  const decision = runArticleQualityGate(
    sourceUrl,
    sourceTitle,
    sourceContent,
  );
  return decision.blocked ? decision.reason : null;
};
