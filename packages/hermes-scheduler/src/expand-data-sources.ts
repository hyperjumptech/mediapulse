import type { PrismaClient } from "@workspace/database";
import {
  isDataSourceString,
  parseDataSourceString,
  type DataSourceParsed,
} from "./data-source-string";

/** Default max rows when take/limit omitted. */
export const DEFAULT_TAKE = 500;

/** Hard cap on rows returned per expansion. */
export const MAX_TAKE = 5000;

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
function buildWhere(
  where: Record<string, string>,
): Record<string, unknown> | undefined {
  if (Object.keys(where).length === 0) return undefined;
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(where)) {
    if (v === "true") result[k] = true;
    else if (v === "false") result[k] = false;
    else if (/^\d+$/.test(v)) result[k] = Number.parseInt(v, 10);
    else result[k] = v;
  }
  return result;
}

/**
 * Applies default and max caps to take value.
 *
 * @param parsed - Parsed data source with optional take.
 * @param defaults - Default and max take values.
 * @returns Effective take value.
 */
function effectiveTake(
  parsed: DataSourceParsed,
  defaults: { defaultTake: number; maxTake: number } = {
    defaultTake: DEFAULT_TAKE,
    maxTake: MAX_TAKE,
  },
): number {
  const requested =
    parsed.take != null && parsed.take >= 0
      ? parsed.take
      : defaults.defaultTake;
  return Math.min(requested, defaults.maxTake);
}

/**
 * Expands a single data source string by querying the database.
 * Uses read-only findMany. Supports any Prisma model, where filters, distinct, take, orderBy.
 *
 * @param parsed - Parsed data source.
 * @param db - Database client (any model with findMany).
 * @param options - Optional defaults for take caps.
 * @returns Array of field values from the table, or null if model not found (caller should pass through).
 */
export const expandSingleDataSource = async (
  parsed: DataSourceParsed,
  db: ExpandDataSourcesDb | PrismaClient,
  options?: { defaultTake?: number; maxTake?: number },
): Promise<unknown[] | null> => {
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
  for (const r of rows) {
    const v = r[parsed.field];
    if (!seen.has(v)) {
      seen.add(v);
      values.push(v);
    }
  }
  return values;
};

/**
 * Expands schedule params by resolving data source strings to concrete values.
 * Returns one param object per combination (Cartesian product if multiple params expand).
 *
 * @param params - Schedule params (values may be data source strings).
 * @param db - Database client for queries.
 * @param options - Optional defaults for take caps.
 * @returns Array of param objects with data source strings replaced by actual values.
 */
export const expandDataSources = async (
  params: Record<string, unknown>,
  db: ExpandDataSourcesDb | PrismaClient,
  options?: { defaultTake?: number; maxTake?: number },
): Promise<Record<string, unknown>[]> => {
  let result: Record<string, unknown>[] = [{}];

  for (const [key, value] of Object.entries(params)) {
    if (!isDataSourceString(value)) {
      result = result.map((r) => ({ ...r, [key]: value }));
      continue;
    }

    const parsed = parseDataSourceString(value);
    if (!parsed) {
      result = result.map((r) => ({ ...r, [key]: value }));
      continue;
    }

    const values = await expandSingleDataSource(parsed, db, options);
    if (values === null) {
      result = result.map((r) => ({ ...r, [key]: value }));
      continue;
    }

    result = result.flatMap((prev) =>
      values.map((v) => ({ ...prev, [key]: v })),
    );
  }

  return result.length > 0 ? result : [{}];
};
