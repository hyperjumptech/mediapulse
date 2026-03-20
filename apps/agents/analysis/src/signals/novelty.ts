/**
 * Scores title novelty using Jaccard similarity against selected titles.
 *
 * @param title - Candidate article title.
 * @param selectedTitles - Already-selected article titles.
 * @returns 0.2 when near-duplicate, otherwise 1.
 */
export const scoreNovelty = ({
  title,
  selectedTitles,
}: {
  title: string;
  selectedTitles: string[];
}): number => {
  const titleTokens = tokenize(title);
  if (titleTokens.size === 0 || selectedTitles.length === 0) {
    return 1;
  }

  const isNearDuplicate = selectedTitles.some((selectedTitle) => {
    const similarity = jaccardSimilarity(titleTokens, tokenize(selectedTitle));
    return similarity > 0.6;
  });

  return isNearDuplicate ? 0.2 : 1;
};

/**
 * Tokenizes free text into a normalized word set.
 *
 * @param value - Input text.
 * @returns Unique normalized tokens.
 */
const tokenize = (value: string): Set<string> =>
  new Set(
    value
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]+/gu, " ")
      .split(/\s+/)
      .map((token) => token.trim())
      .filter((token) => token.length > 1),
  );

/**
 * Computes Jaccard similarity between two token sets.
 *
 * @param left - Left token set.
 * @param right - Right token set.
 * @returns Similarity ratio in [0, 1].
 */
const jaccardSimilarity = (left: Set<string>, right: Set<string>): number => {
  if (left.size === 0 || right.size === 0) {
    return 0;
  }

  const intersectionCount = Array.from(left).filter((token) =>
    right.has(token),
  ).length;
  const unionCount = new Set([...Array.from(left), ...Array.from(right)]).size;
  return unionCount === 0 ? 0 : intersectionCount / unionCount;
};
