const DATA_SOURCE_EXPANSION_REFERENCE_REGEX = /^\{\{dse:([a-zA-Z0-9_-]+)\}\}$/;

/**
 * Parsed `{{dse:<id>}}` reference token.
 */
export type DataSourceExpansionReferenceParsed = {
  id: string;
};

/**
 * Builds a data-source expansion reference token for storage in step input.
 *
 * @param id - DataSourceExpansionTemplate row id.
 * @returns Token in `{{dse:<id>}}` format.
 */
export const buildDataSourceExpansionReference = (id: string): string => {
  return `{{dse:${id}}}`;
};

/**
 * Parses a value as a `{{dse:<id>}}` reference token.
 *
 * @param value - Raw string value from step input.
 * @returns Parsed id when format is valid, otherwise null.
 */
export const parseDataSourceExpansionReference = (
  value: string,
): DataSourceExpansionReferenceParsed | null => {
  const match = value.match(DATA_SOURCE_EXPANSION_REFERENCE_REGEX);
  const id = match?.[1];
  if (!id) {
    return null;
  }
  return { id };
};

/**
 * Returns true when the value is exactly a `{{dse:<id>}}` token.
 *
 * @param value - Unknown input value.
 * @returns Whether the value is a valid data-source expansion reference token.
 */
export const isDataSourceExpansionReference = (
  value: unknown,
): value is string => {
  if (typeof value !== "string") {
    return false;
  }
  return parseDataSourceExpansionReference(value) != null;
};

/**
 * Collects unique data-source expansion ids from top-level object string values.
 *
 * @param input - Step input object.
 * @returns Unique ids found in `{{dse:<id>}}` tokens.
 */
export const collectDataSourceExpansionReferenceIds = (
  input: Record<string, unknown>,
): string[] => {
  const ids = new Set<string>();
  for (const value of Object.values(input)) {
    if (typeof value !== "string") {
      continue;
    }
    const parsed = parseDataSourceExpansionReference(value);
    if (parsed != null) {
      ids.add(parsed.id);
    }
  }
  return [...ids];
};

/**
 * Replaces top-level `{{dse:<id>}}` tokens with expansion strings from a map.
 *
 * @param input - Step input object to rewrite.
 * @param expansionsById - Map of template id to raw expansion string.
 * @returns Rewritten input plus any ids that could not be resolved.
 */
export const replaceDataSourceExpansionReferences = (
  input: Record<string, unknown>,
  expansionsById: ReadonlyMap<string, string>,
): { input: Record<string, unknown>; missingIds: string[] } => {
  const missingIds = new Set<string>();
  const resolvedEntries = Object.entries(input).map(([key, value]) => {
    if (typeof value !== "string") {
      return [key, value] as const;
    }
    const parsed = parseDataSourceExpansionReference(value);
    if (parsed == null) {
      return [key, value] as const;
    }
    const expansionString = expansionsById.get(parsed.id);
    if (expansionString == null) {
      missingIds.add(parsed.id);
      return [key, value] as const;
    }
    return [key, expansionString] as const;
  });

  return {
    input: Object.fromEntries(resolvedEntries),
    missingIds: [...missingIds],
  };
};
