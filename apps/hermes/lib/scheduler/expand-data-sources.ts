import type { PrismaClient } from "@workspace/database";
import {
  isAllowlisted,
  isDataSourceString,
  parseDataSourceString,
} from "./data-source-string";

/** Minimal DB shape needed for data source expansion (injectable for tests). */
export type ExpandDataSourcesDb = {
  ticker: {
    findMany: (args: {
      select: Record<string, boolean>;
      where?: Record<string, unknown>;
      orderBy?: Record<string, string>;
    }) => Promise<Array<Record<string, unknown>>>;
  };
};

/**
 * Expands a single data source string by querying the database. Returns an array of values for the given field.
 *
 * @param parsed - Parsed data source (must be allowlisted).
 * @param db - Database client (ticker.findMany).
 * @returns Array of field values from the table.
 */
export const expandSingleDataSource = async (
  parsed: ReturnType<typeof parseDataSourceString> & {
    table: string;
    field: string;
    filter: string;
    filters: Record<string, string>;
  },
  db: ExpandDataSourcesDb,
): Promise<unknown[]> => {
  if (parsed.table === "ticker") {
    const baseWhere = buildWhereFromFilters(parsed.filters, "ticker") ?? {};
    const where: Record<string, unknown> =
      parsed.filter === "all"
        ? baseWhere
        : { ...baseWhere, [parsed.field]: parsed.filter };
    const whereArg =
      Object.keys(where).length > 0
        ? (where as Parameters<
            ExpandDataSourcesDb["ticker"]["findMany"]
          >[0]["where"])
        : undefined;
    const rows = await db.ticker.findMany({
      select: { [parsed.field]: true },
      where: whereArg,
      orderBy: { id: "asc" },
    });
    return rows.map((r) => r[parsed.field]);
  }
  return [];
};

/**
 * Builds a Prisma-style where clause from simple key=value filters. Only allows known columns.
 */
function buildWhereFromFilters(
  filters: Record<string, string>,
  table: string,
): Record<string, unknown> | undefined {
  if (table !== "ticker" || Object.keys(filters).length === 0) return undefined;
  // Ticker has: id, symbol, name, metadata. No "enabled" in current schema; ignore unknown keys.
  const allowed = ["id", "symbol", "name"];
  const where: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(filters)) {
    if (allowed.includes(k)) where[k] = v;
  }
  return Object.keys(where).length > 0 ? where : undefined;
}

/**
 * Expands schedule params by resolving data source strings to concrete values. Returns one param object per combination (Cartesian product if multiple params expand).
 *
 * @param params - Schedule params (values may be data source strings).
 * @param db - Database client for queries.
 * @returns Array of param objects with data source strings replaced by actual values.
 */
export const expandDataSources = async (
  params: Record<string, unknown>,
  db: ExpandDataSourcesDb | PrismaClient,
): Promise<Record<string, unknown>[]> => {
  let result: Record<string, unknown>[] = [{}];

  for (const [key, value] of Object.entries(params)) {
    if (!isDataSourceString(value)) {
      result = result.map((r) => ({ ...r, [key]: value }));
      continue;
    }

    const parsed = parseDataSourceString(value);
    if (!parsed || !isAllowlisted(parsed)) {
      result = result.map((r) => ({ ...r, [key]: value }));
      continue;
    }

    const values = await expandSingleDataSource(
      parsed,
      db as ExpandDataSourcesDb,
    );

    result = result.flatMap((prev) =>
      values.map((v) => ({ ...prev, [key]: v })),
    );
  }

  return result.length > 0 ? result : [{}];
};
