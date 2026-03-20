/**
 * Computes alias-match relevance for ticker aliases in title/content.
 *
 * @param title - Article title.
 * @param content - Article content.
 * @param aliases - Ticker aliases including symbol/name.
 * @returns 1 when matched in title, 0.7 when only in content, else 0.
 */
export const scoreAliasMatch = ({
  title,
  content,
  aliases,
}: {
  title: string;
  content: string;
  aliases: string[];
}): number => {
  const normalizedTitle = normalizeText(title);
  const normalizedContent = normalizeText(content);
  const normalizedAliases = aliases
    .map(normalizeText)
    .filter((alias) => alias.length > 0);

  if (
    normalizedAliases.some((alias) => containsToken(normalizedTitle, alias))
  ) {
    return 1;
  }

  if (
    normalizedAliases.some((alias) => containsToken(normalizedContent, alias))
  ) {
    return 0.7;
  }

  return 0;
};

/**
 * Normalizes text by lowercasing and removing non-alphanumeric separators.
 *
 * @param value - Raw text.
 * @returns Normalized tokenizable string.
 */
const normalizeText = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

/**
 * Checks whether a token appears in normalized text by token boundaries.
 *
 * @param text - Normalized text.
 * @param token - Normalized token.
 * @returns True when token is present.
 */
const containsToken = (text: string, token: string): boolean => {
  if (!text || !token) {
    return false;
  }

  const padded = ` ${text} `;
  return padded.includes(` ${token} `);
};
