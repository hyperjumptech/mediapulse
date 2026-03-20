/**
 * Scores entity overlap against existing ticker entities.
 *
 * @param articleEntities - Extracted canonical entity names from an article.
 * @param existingEntityNames - Existing ticker entity names and aliases.
 * @returns matched/total, or 0 when no article entities exist.
 */
export const scoreEntityOverlap = ({
  articleEntities,
  existingEntityNames,
}: {
  articleEntities: string[];
  existingEntityNames: string[];
}): number => {
  const normalizedArticle = Array.from(
    new Set(articleEntities.map(normalizeToken).filter(Boolean)),
  );
  if (normalizedArticle.length === 0) {
    return 0;
  }

  const existingSet = new Set(
    existingEntityNames.map(normalizeToken).filter(Boolean),
  );
  const matched = normalizedArticle.filter((entity) => existingSet.has(entity));
  return matched.length / normalizedArticle.length;
};

/**
 * Normalizes entity names for overlap matching.
 *
 * @param value - Raw entity name.
 * @returns Lowercased token.
 */
const normalizeToken = (value: string): string =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}\s]+/gu, "")
    .replace(/\s+/g, " ");
