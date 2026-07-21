/** Reason a candidate failed a deterministic collection gate. */
export type CollectionGateDropReason =
  | "junk_title"
  | "description_too_short"
  | "duplicate_title";

/**
 * Minimum description length that still carries signal for downstream analysis.
 *
 * - Important: deliberately conservative. It is sized to catch stubs like
 *   `"Read more"` or a bare headline echo, not to enforce a quality bar, since
 *   many legitimate feeds emit one-sentence summaries.
 */
export const MIN_DESCRIPTION_CHARS = 40;

const JUNK_TITLE_PHRASES = [
  "just a moment",
  "attention required",
  "checking your browser",
  "verify you are human",
  "are you a robot",
  "please enable javascript",
  "javascript is disabled",
  "javascript is required",
  "page not found",
  "not found",
  "no longer available",
  "access denied",
  "access to this page has been denied",
  "forbidden",
  "unauthorized",
  "service unavailable",
  "bad gateway",
  "too many requests",
  "rate limit exceeded",
  "site maintenance",
  "under maintenance",
  "temporarily unavailable",
  "subscribe to continue",
  "subscribe to read",
  "sign in to continue",
  "log in to continue",
  "untitled",
  "error",
];

const JUNK_TITLE_PREFIXES = [
  "404",
  "403",
  "401",
  "429",
  "500",
  "502",
  "503",
  "error 4",
  "error 5",
  "http error",
];

/**
 * Normalizes a title for gate comparisons: lowercased, punctuation stripped,
 * whitespace collapsed, and any trailing ` - Publisher` style suffix removed.
 *
 * @param title - Raw title from discovery or search.
 */
export const normalizeTitleKey = (title: string): string => {
  const withoutSuffix = title.replace(/\s+[|–—-]\s+[^|–—-]{1,40}$/u, "");
  return withoutSuffix
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
};

/**
 * Returns whether a title is an error page, bot interstitial, or paywall stub
 * rather than an article headline.
 *
 * Matching is anchored to the whole normalized title (or a numeric status-code
 * prefix) so real headlines that merely contain a phrase like `access denied`
 * are not dropped.
 *
 * - Important: an absent title is not junk. Discovery failing to extract a
 *   headline is a different condition from the page being an error stub, and
 *   conflating them mislabels the drop reason. Untitled candidates fall through
 *   to the description gates.
 *
 * @param title - Raw title from discovery or search.
 */
export const isJunkTitle = (title: string): boolean => {
  const normalized = normalizeTitleKey(title);
  if (normalized.length === 0) {
    return false;
  }

  if (JUNK_TITLE_PHRASES.includes(normalized)) {
    return true;
  }

  return JUNK_TITLE_PREFIXES.some((prefix) => normalized.startsWith(prefix));
};

/**
 * Returns whether a description carries enough text to be worth analyzing.
 *
 * @param description - Feed or meta description, when discovery yielded one.
 * @param minChars - Minimum length required.
 */
export const hasSufficientDescription = (
  description: string | undefined,
  minChars: number = MIN_DESCRIPTION_CHARS,
): boolean => (description?.trim().length ?? 0) >= minChars;

/**
 * Tracks normalized titles within a run so syndicated copies of the same story
 * published under different canonical URLs are collected once.
 */
export type TitleDeduper = {
  /** Records the title and returns whether it was already seen this run. */
  isDuplicate: (title: string) => boolean;
};

/**
 * Creates a per-run title deduper. Titles that normalize to an empty string are
 * never treated as duplicates, since they carry no comparison signal.
 */
export const createTitleDeduper = (): TitleDeduper => {
  const seen = new Set<string>();

  return {
    isDuplicate: (title: string): boolean => {
      const key = normalizeTitleKey(title);
      if (key.length === 0) {
        return false;
      }
      if (seen.has(key)) {
        return true;
      }
      seen.add(key);

      return false;
    },
  };
};
