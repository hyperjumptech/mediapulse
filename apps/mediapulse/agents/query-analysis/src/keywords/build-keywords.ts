/** An entity that can be expanded into query texts (own company, competitor, regulator). */
export type KeywordEntity = {
  name: string;
  searchKeywords?: string[];
};

/**
 * Expands an entity into candidate query texts: the bare name plus `name keyword` combinations.
 *
 * @param entity - Entity name and optional search keywords.
 * @param maxKeywords - Maximum keyword-augmented queries to emit.
 * @returns Deduped, trimmed query texts for the entity.
 */
export const buildEntityQueryTexts = (
  entity: KeywordEntity,
  maxKeywords: number,
): string[] => {
  const name = entity.name.trim();
  if (name.length === 0) {
    return [];
  }

  const texts = [name];
  const keywords = (entity.searchKeywords ?? []).slice(0, maxKeywords);
  for (const keyword of keywords) {
    const trimmedKeyword = keyword.trim();
    if (trimmedKeyword.length === 0) {
      continue;
    }
    texts.push(`${name} ${trimmedKeyword}`);
  }

  return [...new Set(texts)];
};
