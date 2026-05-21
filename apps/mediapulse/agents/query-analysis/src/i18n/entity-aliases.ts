/** Static entity alias map: symbol → language → display name. */
export const ENTITY_ALIASES_BY_SYMBOL: Record<
  string,
  Record<string, string>
> = {
  BBCA: {
    en: "Bank Central Asia",
    id: "Bank Central Asia",
  },
  BCA: {
    en: "Bank Central Asia",
    id: "Bank Central Asia",
  },
};

/**
 * Returns the primary BCP-47 language subtag (e.g. `id-ID` → `id`).
 *
 * @param language - BCP-47 language tag.
 * @returns Lowercase primary subtag.
 */
export const primaryLanguageSubtag = (language: string): string =>
  language.trim().split("-")[0]?.toLowerCase() ?? language.toLowerCase();

/**
 * Resolves the language-appropriate display name for a ticker, when aliased.
 *
 * @param symbol - Ticker symbol.
 * @param canonicalName - Default company name from GET context.
 * @param language - Target query language (BCP-47).
 * @returns Alias when registered; otherwise the canonical name.
 */
export const resolveEntityDisplayName = (
  symbol: string,
  canonicalName: string,
  language: string,
): string => {
  const aliases = ENTITY_ALIASES_BY_SYMBOL[symbol.trim().toUpperCase()];
  if (!aliases) {
    return canonicalName;
  }
  const primary = primaryLanguageSubtag(language);
  return aliases[primary] ?? aliases[language] ?? canonicalName;
};
