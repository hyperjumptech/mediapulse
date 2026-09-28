import type {
  DashboardColumnFormat,
  DashboardPageColumn,
} from "@hermes/domain-contract";

import {
  mergeColumnVisibility,
  type ColumnVisibility,
} from "@/lib/data-table/column-visibility";
import type { DataTableMobileRole } from "@/lib/data-table/features";
import {
  formatDateTime,
  toValidDate,
  type DateTimeStyle,
} from "@/lib/date-time/format-date-time";
import { formatCompactDuration } from "@/lib/format-duration";

export type DomainTableRow = Record<string, unknown>;

export type DomainTableColumn = DashboardPageColumn;

export type DomainTableCellFormatOptions = {
  timeZone: string;
  now: Date;
  style?: DateTimeStyle;
};

const LAST_MOBILE_FIELD_INDEX = 4;

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const DATE_ONLY_TIME_ZONE = "UTC";

const TABLE_ID_UNSAFE_CHARACTERS = /[^A-Za-z0-9_-]/g;

const NUMERIC_FORMATS: ReadonlySet<DashboardColumnFormat> = new Set([
  "number",
  "duration-ms",
]);

const numberFormatter = new Intl.NumberFormat("en-US");

export const resolveDomainColumnFormat = (
  column: Pick<DomainTableColumn, "type" | "format">,
): DashboardColumnFormat => column.format ?? column.type;

export const isNumericDomainColumnFormat = (
  format: DashboardColumnFormat,
): boolean => NUMERIC_FORMATS.has(format);

export const isEmptyDomainCellValue = (value: unknown): boolean =>
  value === null ||
  value === undefined ||
  (typeof value === "string" && value.trim().length === 0);

export const formatDomainBoolean = (value: boolean): string =>
  value ? "Yes" : "No";

export const stringifyDomainCellValue = (value: unknown): string => {
  if (isEmptyDomainCellValue(value)) {
    return "";
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "boolean") {
    return formatDomainBoolean(value);
  }
  if (value instanceof Date) {
    return toValidDate(value)?.toISOString() ?? "";
  }
  if (typeof value === "object") {
    return JSON.stringify(value);
  }

  return String(value);
};

export const toDomainCellNumber = (value: unknown): number | null => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }
  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : null;
};

export const toDomainCellBoolean = (value: unknown): boolean | null => {
  if (typeof value === "boolean") {
    return value;
  }
  if (value === "true") {
    return true;
  }
  if (value === "false") {
    return false;
  }

  return null;
};

export const formatDomainNumber = (value: number): string =>
  numberFormatter.format(value);

export const formatDomainDuration = (milliseconds: number): string =>
  formatCompactDuration(Math.round(milliseconds));

export const humanizeDomainBadgeValue = (value: string): string =>
  value.replaceAll(/[_-]/g, " ");

export const resolveDomainDateTimeZone = (
  value: unknown,
): string | undefined =>
  typeof value === "string" && DATE_ONLY_PATTERN.test(value.trim())
    ? DATE_ONLY_TIME_ZONE
    : undefined;

const formatDomainDateValue = (
  rawValue: unknown,
  format: "date-time" | "date",
  { timeZone, now, style = "compact" }: DomainTableCellFormatOptions,
): string => {
  const date = toValidDate(rawValue);
  if (!date) {
    return stringifyDomainCellValue(rawValue);
  }
  if (format === "date") {
    const dateTimeZone = resolveDomainDateTimeZone(rawValue) ?? timeZone;

    return formatDateTime(date, { timeZone: dateTimeZone, now, style: "date" });
  }

  return formatDateTime(date, { timeZone, now, style });
};

export const formatDomainTableCellValue = (
  column: Pick<DomainTableColumn, "type" | "format">,
  rawValue: unknown,
  options: DomainTableCellFormatOptions,
): string => {
  if (isEmptyDomainCellValue(rawValue)) {
    return "";
  }
  const format = resolveDomainColumnFormat(column);
  if (format === "date-time" || format === "date") {
    return formatDomainDateValue(rawValue, format, options);
  }
  if (format === "number" || format === "duration-ms") {
    const numericValue = toDomainCellNumber(rawValue);
    if (numericValue === null) {
      return stringifyDomainCellValue(rawValue);
    }

    return format === "number"
      ? formatDomainNumber(numericValue)
      : formatDomainDuration(numericValue);
  }
  if (format === "boolean") {
    const booleanValue = toDomainCellBoolean(rawValue);

    return booleanValue === null
      ? stringifyDomainCellValue(rawValue)
      : formatDomainBoolean(booleanValue);
  }
  if (format === "badge") {
    return humanizeDomainBadgeValue(stringifyDomainCellValue(rawValue));
  }

  return stringifyDomainCellValue(rawValue);
};

export const resolveDomainColumnMobileRole = (
  column: Pick<DomainTableColumn, "mobile">,
  index: number,
): DataTableMobileRole => {
  if (index === 0) {
    return "title";
  }
  const fallbackRole = index <= LAST_MOBILE_FIELD_INDEX ? "field" : "hidden";
  const role = column.mobile ?? fallbackRole;

  return role === "title" ? "subtitle" : role;
};

export const buildDomainTableId = (
  integrationId: string,
  resource: string,
): string =>
  `domain-${integrationId}-${resource}`.replaceAll(
    TABLE_ID_UNSAFE_CHARACTERS,
    "_",
  );

export const buildDomainTableDefaultColumnVisibility = (
  columns: readonly Pick<DomainTableColumn, "key" | "defaultHidden">[],
): ColumnVisibility => {
  const hiddenColumns = columns
    .slice(1)
    .filter((column) => column.defaultHidden === true);

  return Object.fromEntries(hiddenColumns.map((column) => [column.key, false]));
};

export const mergeDomainTableColumnVisibility = (
  columns: readonly Pick<DomainTableColumn, "key" | "defaultHidden">[],
  saved: ColumnVisibility,
): ColumnVisibility => {
  const defaults = buildDomainTableDefaultColumnVisibility(columns);
  const merged = mergeColumnVisibility(defaults, saved);
  const titleKey = columns[0]?.key;
  const hideableEntries = Object.entries(merged).filter(
    ([key]) => key !== titleKey,
  );

  return Object.fromEntries(hideableEntries);
};

export const readDomainTableRowId = (row: DomainTableRow): string =>
  String(row.id ?? "");

export const buildDomainTableItemHref = (
  basePath: string,
  rowId: string,
): string => `${basePath}/${encodeURIComponent(rowId)}`;
