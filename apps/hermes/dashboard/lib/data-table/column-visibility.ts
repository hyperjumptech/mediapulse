export type ColumnVisibility = Record<string, boolean>;

const COLUMN_VISIBILITY_COOKIE_PREFIX = "hermes_dt_";

export const COLUMN_VISIBILITY_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

export const columnVisibilityCookieName = (tableId: string): string =>
  `${COLUMN_VISIBILITY_COOKIE_PREFIX}${tableId}`;

export const parseColumnVisibility = (
  raw: string | undefined | null,
): ColumnVisibility => {
  if (!raw) {
    return {};
  }
  try {
    const parsed: unknown = JSON.parse(decodeURIComponent(raw));
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      Array.isArray(parsed)
    ) {
      return {};
    }

    return Object.fromEntries(
      Object.entries(parsed).filter(
        (entry): entry is [string, boolean] => typeof entry[1] === "boolean",
      ),
    );
  } catch {
    return {};
  }
};

export const serializeColumnVisibility = (
  visibility: ColumnVisibility,
): string => encodeURIComponent(JSON.stringify(visibility));

export const mergeColumnVisibility = (
  defaults: ColumnVisibility,
  saved: ColumnVisibility,
): ColumnVisibility => ({ ...defaults, ...saved });
