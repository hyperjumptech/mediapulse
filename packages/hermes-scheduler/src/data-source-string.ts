/**
 * Parsed data source string: db:table:selector:field with optional query options.
 * Supports where.*, distinct, take/limit, and orderBy for dynamic table expansion.
 */
export type DataSourceParsed = {
  source: string;
  table: string;
  selector: string;
  field: string;
  /** Where clause from where.<key>=<value> query params. */
  where: Record<string, string>;
  /** Field for distinct selection. */
  distinct?: string;
  /** Max rows to return (take/limit). */
  take?: number;
  /** Order by field and direction. */
  orderBy?: { field: string; dir: "asc" | "desc" };
};

const DATA_SOURCE_REGEX =
  /^([a-z]+):([a-zA-Z][a-zA-Z0-9]*):([a-zA-Z0-9_-]*):([a-zA-Z_][a-zA-Z0-9_]*)(?:\?(.*))?$/;

/**
 * Returns true if the value looks like a data source string (db:table:selector:field).
 *
 * @param value - Parameter value (string or other).
 * @returns True if value is a string matching the data source format.
 */
export const isDataSourceString = (value: unknown): value is string => {
  return typeof value === "string" && DATA_SOURCE_REGEX.test(value);
};

/**
 * Parses a data source string into components.
 * Supports: where.<key>=<value>, distinct=<field>, take=<n>, limit=<n>, orderBy=<field>:<dir>.
 *
 * @param str - Data source string (e.g. db:userTicker:all:tickerId?where.enabled=true&distinct=tickerId&take=100).
 * @returns Parsed components, or null if format is invalid.
 */
export const parseDataSourceString = (str: string): DataSourceParsed | null => {
  const match = str.match(DATA_SOURCE_REGEX);
  if (!match) return null;
  const [, source, table, selector, field, query] = match;
  if (!source || !table || !field) return null;

  const where: Record<string, string> = {};
  let distinct: string | undefined;
  let take: number | undefined;
  let orderBy: { field: string; dir: "asc" | "desc" } | undefined;

  if (query) {
    for (const part of query.split("&")) {
      const eqIdx = part.indexOf("=");
      if (eqIdx < 0) continue;
      const k = decodeURIComponent(part.slice(0, eqIdx));
      const v = decodeURIComponent(part.slice(eqIdx + 1));

      if (k.startsWith("where.")) {
        const key = k.slice(6);
        if (key && /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key)) {
          where[key] = v;
        }
      } else if (k === "distinct" && v) {
        distinct = /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(v) ? v : undefined;
      } else if (k === "take" || k === "limit") {
        const n = Number.parseInt(v, 10);
        if (Number.isFinite(n)) {
          take = take != null ? Math.min(take, n) : n;
        }
      } else if (k === "orderBy" && v) {
        const [orderField, dir] = v.split(":");
        if (
          orderField &&
          /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(orderField) &&
          (dir === "asc" || dir === "desc")
        ) {
          orderBy = { field: orderField, dir };
        }
      }
    }
  }

  return {
    source,
    table,
    selector: selector ?? "all",
    field,
    where,
    distinct,
    take,
    orderBy,
  };
};
