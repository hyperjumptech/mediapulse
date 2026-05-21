/**
 * Short common words excluded from overlap scoring to focus on meaningful terms.
 * Kept minimal so the filter is fast and language-agnostic.
 */
export const STOP_WORDS = new Set([
  "a",
  "an",
  "the",
  "is",
  "are",
  "was",
  "were",
  "be",
  "been",
  "being",
  "to",
  "of",
  "and",
  "or",
  "in",
  "on",
  "at",
  "for",
  "with",
  "by",
  "as",
  "it",
  "its",
  "that",
  "this",
  "has",
  "had",
  "have",
  "not",
  "but",
  "from",
  "up",
  "all",
]);

const MIN_WINDOW_SIZE = 2;
const MAX_WINDOW_SIZE = 7;

/** Minimum Jaccard overlap score required to accept a window as a matching phrase. */
const MIN_SCORE_THRESHOLD = 0.2;

/**
 * Tokenizes a string into lowercase, punctuation-stripped, stop-word-filtered terms.
 *
 * @param text - Raw text to tokenize.
 * @returns Array of meaningful lowercase terms.
 */
export const tokenize = (text: string): string[] =>
  text
    .toLowerCase()
    .split(/\W+/)
    .filter((t) => t.length >= 3 && !STOP_WORDS.has(t));

/**
 * Finds the contiguous word window in `text` whose tokens best overlap with
 * `titleTokens` using a Jaccard-like score.
 *
 * Windows range from `MIN_WINDOW_SIZE` to `MAX_WINDOW_SIZE` words. The function
 * returns the raw phrase string (original casing, punctuation preserved) for the
 * best-scoring window, or `null` when no window exceeds `MIN_SCORE_THRESHOLD`.
 *
 * @param text - Summary text to search within.
 * @param titleTokens - Pre-tokenized meaningful terms from the article title.
 * @returns Best-matching phrase string, or `null` if no good match exists.
 */
export const findBestMatchingPhrase = (
  text: string,
  titleTokens: ReadonlySet<string>,
): string | null => {
  if (titleTokens.size === 0) return null;

  // Split on whitespace boundaries, keeping the original word strings for reconstruction.
  const words = text.split(/\s+/).filter((w) => w.length > 0);
  if (words.length < MIN_WINDOW_SIZE) return null;

  let bestScore = 0;
  let bestStart = -1;
  let bestEnd = -1;

  for (
    let windowSize = MIN_WINDOW_SIZE;
    windowSize <= Math.min(MAX_WINDOW_SIZE, words.length);
    windowSize++
  ) {
    for (let i = 0; i <= words.length - windowSize; i++) {
      const windowWords = words.slice(i, i + windowSize);
      const windowTokens = windowWords.flatMap((w) => tokenize(w));

      const overlapCount = windowTokens.filter((t) =>
        titleTokens.has(t),
      ).length;

      if (overlapCount === 0) continue;

      // Jaccard-like: overlap / max(|title tokens|, |window tokens|)
      const score =
        overlapCount / Math.max(titleTokens.size, windowTokens.length);

      if (score > bestScore) {
        bestScore = score;
        bestStart = i;
        bestEnd = i + windowSize;
      }
    }
  }

  if (bestScore < MIN_SCORE_THRESHOLD || bestStart === -1) return null;

  return words.slice(bestStart, bestEnd).join(" ");
};

/**
 * Injects a markdown link into `summary` by finding the phrase that best matches
 * the article `title` and wrapping it as `[phrase](url)`.
 *
 * Uses a sliding word-window with Jaccard-like token overlap scoring. If a
 * matching phrase is found, the first occurrence in the summary is replaced with
 * the markdown link. If no phrase meets the minimum overlap threshold, the summary
 * is returned unchanged.
 *
 * @param summary - Plain-prose summary text produced by the LLM.
 * @param title - Article title used to find the best matching phrase.
 * @param url - Article URL to use as the link target.
 * @returns Summary with an injected `[phrase](url)` link, or the original summary
 *   if no suitable phrase was found.
 */
export const injectTitlePhraseLink = (
  summary: string,
  title: string,
  url: string,
): string => {
  const titleTokens = new Set(tokenize(title));
  const phrase = findBestMatchingPhrase(summary, titleTokens);

  if (!phrase) return summary;

  // Escape special regex characters in the phrase for a safe replacement.
  const escapedPhrase = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return summary.replace(new RegExp(escapedPhrase, "i"), `[${phrase}](${url})`);
};
