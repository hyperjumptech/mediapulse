import type { Prisma, PrismaClient } from "@hermes/orchestration-database";

const DATA_SOURCE_EXPANSION_REFERENCE_REGEX = /^\{\{dse:([a-zA-Z0-9_-]+)\}\}$/;

type DataSourceExpansionTemplateDelegate = Pick<
  PrismaClient["dataSourceExpansionTemplate"],
  "findMany"
>;

type DataSourceExpansionTemplateRow =
  Prisma.DataSourceExpansionTemplateGetPayload<{
    select: { id: true; expansionString: true };
  }>;

/**
 * Parses a `{{dse:<id>}}` token and returns the referenced id.
 *
 * @param value - Raw value from step input.
 * @returns Parsed id or null when the value is not a valid token.
 */
const parseDataSourceExpansionReference = (value: string): string | null => {
  const match = value.match(DATA_SOURCE_EXPANSION_REFERENCE_REGEX);
  return match?.[1] ?? null;
};

/**
 * Collects unique data-source expansion ids from top-level input values.
 *
 * @param input - Step input object.
 * @returns Unique ids found in `{{dse:<id>}}` tokens.
 */
const collectDataSourceExpansionReferenceIds = (
  input: Record<string, unknown>,
): string[] => {
  const ids = new Set<string>();
  for (const value of Object.values(input)) {
    if (typeof value !== "string") {
      continue;
    }
    const id = parseDataSourceExpansionReference(value);
    if (id != null) {
      ids.add(id);
    }
  }
  return [...ids];
};

/**
 * Replaces top-level `{{dse:<id>}}` tokens using a lookup map.
 *
 * @param input - Step input object to rewrite.
 * @param expansionsById - Map of template id to raw expansion string.
 * @returns Rewritten input plus ids that were not found in the map.
 */
const replaceDataSourceExpansionReferences = (
  input: Record<string, unknown>,
  expansionsById: ReadonlyMap<string, string>,
): { input: Record<string, unknown>; missingIds: string[] } => {
  const missingIds = new Set<string>();
  const resolvedEntries = Object.entries(input).map(([key, value]) => {
    if (typeof value !== "string") {
      return [key, value] as const;
    }
    const id = parseDataSourceExpansionReference(value);
    if (id == null) {
      return [key, value] as const;
    }
    const expansionString = expansionsById.get(id);
    if (expansionString == null) {
      missingIds.add(id);
      return [key, value] as const;
    }
    return [key, expansionString] as const;
  });
  return {
    input: Object.fromEntries(resolvedEntries),
    missingIds: [...missingIds],
  };
};

/**
 * Loads expansion template rows for ids scoped to a domain integration.
 *
 * @param db - DataSourceExpansionTemplate delegate.
 * @param domainIntegrationId - Pipeline domain integration id.
 * @param ids - Template ids extracted from step input.
 * @returns Rows containing id and raw expansion string.
 */
const findExpansionTemplateRowsById = async (
  db: DataSourceExpansionTemplateDelegate,
  domainIntegrationId: string,
  ids: string[],
): Promise<DataSourceExpansionTemplateRow[]> => {
  if (ids.length === 0) {
    return [];
  }
  const args = {
    where: {
      domainIntegrationId,
      id: { in: ids },
    },
    select: {
      id: true,
      expansionString: true,
    },
  } satisfies Prisma.DataSourceExpansionTemplateFindManyArgs;
  return db.findMany(args);
};

/**
 * Replaces `{{dse:<id>}}` tokens with raw `db:` expansion strings before
 * calling the domain expansion API.
 *
 * @param input - Step input object.
 * @param domainIntegrationId - Pipeline domain integration id.
 * @param db - DataSourceExpansionTemplate delegate.
 * @returns Input object with references resolved.
 */
export const resolveDataSourceExpansionReferencesInInput = async (
  input: Record<string, unknown>,
  domainIntegrationId: string,
  db: DataSourceExpansionTemplateDelegate,
): Promise<Record<string, unknown>> => {
  const ids = collectDataSourceExpansionReferenceIds(input);
  if (ids.length === 0) {
    return input;
  }
  const rows = await findExpansionTemplateRowsById(
    db,
    domainIntegrationId,
    ids,
  );
  const expansionMap = new Map(
    rows.map((row) => [row.id, row.expansionString]),
  );
  const resolved = replaceDataSourceExpansionReferences(input, expansionMap);
  if (resolved.missingIds.length > 0) {
    throw new Error(
      `Data source expansion template not found for id(s): ${resolved.missingIds.join(", ")}`,
    );
  }
  return resolved.input;
};
