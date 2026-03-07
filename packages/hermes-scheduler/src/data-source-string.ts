/**
 * Parsed data source string: db:table:filter:field with optional ?key=value options.
 */
export type DataSourceParsed = {
  source: string;
  table: string;
  filter: string;
  field: string;
  batchSize?: number;
  staggerDelay?: number;
  /** Simple key=value filters from query string (e.g. enabled=true). */
  filters: Record<string, string>;
};

const DATA_SOURCE_REGEX =
  /^([a-z]+):([a-z_]+):([a-z0-9_-]+):([a-z_]+)(?:\?(.*))?$/i;

/** Tables allowed for data source expansion (maps to Prisma model names). */
export const ALLOWLIST_TABLES = ["ticker"] as const;

/** Fields allowed per table to prevent injection. */
export const ALLOWLIST_FIELDS: Record<string, readonly string[]> = {
  ticker: ["id", "symbol"],
};

/**
 * Returns true if the value looks like a data source string (db:table:filter:field).
 *
 * @param value - Parameter value (string or other).
 * @returns True if value is a string matching the data source format.
 */
export const isDataSourceString = (value: unknown): value is string => {
  return typeof value === "string" && DATA_SOURCE_REGEX.test(value);
};

/**
 * Parses a data source string into components. Does not validate table/field allowlist.
 *
 * @param str - Data source string (e.g. db:ticker:all:id?batchSize=10).
 * @returns Parsed components, or null if format is invalid.
 */
export const parseDataSourceString = (str: string): DataSourceParsed | null => {
  const match = str.match(DATA_SOURCE_REGEX);
  if (!match) return null;
  const [, source, table, filter, field, query] = match;
  if (!source || !table || !filter || !field) return null;

  const filters: Record<string, string> = {};
  let batchSize: number | undefined;
  let staggerDelay: number | undefined;

  if (query) {
    for (const part of query.split("&")) {
      const [k, v] = part.split("=").map(decodeURIComponent);
      if (!k || v === undefined) continue;
      if (k === "batchSize") batchSize = Number.parseInt(v, 10);
      else if (k === "staggerDelay") staggerDelay = Number.parseInt(v, 10);
      else filters[k] = v;
    }
  }

  return {
    source,
    table,
    filter,
    field,
    batchSize: batchSize && Number.isFinite(batchSize) ? batchSize : undefined,
    staggerDelay:
      staggerDelay && Number.isFinite(staggerDelay) ? staggerDelay : undefined,
    filters,
  };
};

/**
 * Validates that table and field are allowlisted for safe DB access.
 *
 * @param parsed - Result of parseDataSourceString.
 * @returns True if table and field are allowed.
 */
export const isAllowlisted = (parsed: DataSourceParsed): boolean => {
  if (
    !ALLOWLIST_TABLES.includes(
      parsed.table as (typeof ALLOWLIST_TABLES)[number],
    )
  )
    return false;
  const fields = ALLOWLIST_FIELDS[parsed.table];
  return Boolean(fields?.includes(parsed.field));
};
