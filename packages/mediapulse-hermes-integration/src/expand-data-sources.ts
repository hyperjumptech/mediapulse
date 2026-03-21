import type { PrismaClient } from "@workspace/mediapulse-database";
import {
  DEFAULT_TAKE,
  MAX_TAKE,
  isDataSourceString,
  parseDataSourceString,
  type DataSourceParsed,
} from "@workspace/hermes-step-input-syntax";

export { DEFAULT_TAKE, MAX_TAKE } from "@workspace/hermes-step-input-syntax";
export type { DataSourceParsed } from "@workspace/hermes-step-input-syntax";

/** Minimal DB shape for data source expansion (injectable for tests). */
export type ExpandDataSourcesDb = {
  [key: string]: {
    findMany: (args: {
      select: Record<string, boolean>;
      where?: Record<string, unknown>;
      orderBy?: Record<string, string> | Array<Record<string, string>>;
      distinct?: string | string[];
      take?: number;
    }) => Promise<Array<Record<string, unknown>>>;
  };
};

/**
 * Converts parsed where record to Prisma where clause with equality filters.
 * Coerces "true"/"false" to boolean, numeric strings to number where appropriate.
 *
 * @param where - Key-value filters from query string.
 * @returns Prisma where object or undefined if empty.
 */
const buildWhere = (
  where: Record<string, string>,
): Record<string, unknown> | undefined => {
  if (Object.keys(where).length === 0) return undefined;
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(where)) {
    if (v === "true") result[k] = true;
    else if (v === "false") result[k] = false;
    else if (/^\d+$/.test(v)) result[k] = Number.parseInt(v, 10);
    else result[k] = v;
  }
  return result;
};

/**
 * Applies default and max caps to take value.
 *
 * @param parsed - Parsed data source with optional take.
 * @param defaults - Default and max take values.
 * @returns Effective take value.
 */
const effectiveTake = (
  parsed: DataSourceParsed,
  defaults: { defaultTake: number; maxTake: number } = {
    defaultTake: DEFAULT_TAKE,
    maxTake: MAX_TAKE,
  },
): number => {
  const requested =
    parsed.take != null && parsed.take >= 0
      ? parsed.take
      : defaults.defaultTake;
  return Math.min(requested, defaults.maxTake);
};

/**
 * Expands a single data source string by querying the database.
 * Uses read-only findMany. Supports any Prisma model, where filters, distinct, take, orderBy.
 *
 * @param parsed - Parsed data source.
 * @param db - Database client (any model with findMany).
 * @param options - Optional defaults for take caps and table allowlist.
 * @returns Array of field values from the table, or null if model not found (caller should pass through).
 */
export const expandSingleDataSource = async (
  parsed: DataSourceParsed,
  db: ExpandDataSourcesDb | PrismaClient,
  options?: {
    defaultTake?: number;
    maxTake?: number;
    allowlistedTables?: string[] | null;
  },
): Promise<unknown[] | null> => {
  if (
    options?.allowlistedTables != null &&
    !options.allowlistedTables.includes(parsed.table)
  ) {
    throw new Error(
      `Data source table "${parsed.table}" is not allowlisted for expansion`,
    );
  }

  const model = (db as ExpandDataSourcesDb)[parsed.table];
  if (!model || typeof model.findMany !== "function") {
    return null;
  }

  const take = effectiveTake(parsed, {
    defaultTake: options?.defaultTake ?? DEFAULT_TAKE,
    maxTake: options?.maxTake ?? MAX_TAKE,
  });

  const where = buildWhere(parsed.where);
  const select: Record<string, boolean> = { [parsed.field]: true };
  const distinctField = parsed.distinct ?? parsed.field;
  const orderBy = parsed.orderBy
    ? { [parsed.orderBy.field]: parsed.orderBy.dir }
    : { [parsed.field]: "asc" as const };

  const rows = await model.findMany({
    select,
    where: Object.keys(where ?? {}).length > 0 ? where : undefined,
    orderBy,
    distinct: [distinctField],
    take,
  });

  const seen = new Set<unknown>();
  const values: unknown[] = [];
  for (const row of rows) {
    const value = row[parsed.field];
    if (!seen.has(value)) {
      seen.add(value);
      values.push(value);
    }
  }
  return values;
};

/**
 * Expands params by resolving data source strings to concrete values.
 * Returns one param object per combination (Cartesian product if multiple params expand).
 *
 * @param params - Params where values may be data source strings.
 * @param db - Database client for queries.
 * @param options - Optional defaults for take caps and table allowlist.
 * @returns Expanded param objects.
 */
export const expandDataSources = async (
  params: Record<string, unknown>,
  db: ExpandDataSourcesDb | PrismaClient,
  options?: {
    defaultTake?: number;
    maxTake?: number;
    allowlistedTables?: string[] | null;
  },
): Promise<Record<string, unknown>[]> => {
  let result: Record<string, unknown>[] = [{}];

  for (const [key, value] of Object.entries(params)) {
    if (!isDataSourceString(value)) {
      result = result.map((entry) => ({ ...entry, [key]: value }));
      continue;
    }

    const parsed = parseDataSourceString(value);
    if (!parsed) {
      result = result.map((entry) => ({ ...entry, [key]: value }));
      continue;
    }

    const values = await expandSingleDataSource(parsed, db, options);
    if (values === null) {
      result = result.map((entry) => ({ ...entry, [key]: value }));
      continue;
    }

    result = result.flatMap((entry) =>
      values.map((expandedValue) => ({ ...entry, [key]: expandedValue })),
    );
  }

  return result.length > 0 ? result : [{}];
};
