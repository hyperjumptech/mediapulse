/** The kinds of thing a knowledge-base entity can be, as the extraction schema offers them. */
export const KNOWLEDGE_ENTITY_KINDS = [
  "issuer",
  "company",
  "brand",
  "regulator",
  "government",
  "person",
  "product",
  "place",
  "other",
] as const;

export type KnowledgeEntityKindName = (typeof KNOWLEDGE_ENTITY_KINDS)[number];

/**
 * Turns a slug into the phrase an edge prints, for a kind with no registry row to read a label from.
 *
 * @param slug - Relation kind slug.
 */
export const labelForSlug = (slug: string): string => slug.replace(/_/gu, " ");

/**
 * Turns an emitted phrase into a slug.
 *
 * @param phrase - The phrase as the model wrote it.
 * @returns A slug, or null when the phrase carries nothing usable.
 */
export const slugForPhrase = (phrase: string): string | null => {
  const slug = phrase
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/gu, "_")
    .replace(/^_+|_+$/gu, "");

  return slug.length === 0 ? null : slug;
};
