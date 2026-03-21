/** Default page size for table-v1 list endpoints when the client omits `pageSize`. */
export const DEFAULT_PAGE_SIZE = 15;

/** Maximum allowed page size for table-v1 list endpoints. */
export const MAX_PAGE_SIZE = 100;

/**
 * Parses common list pagination params for table-v1 endpoints.
 *
 * @param pageRaw - Raw page value from query string.
 * @param pageSizeRaw - Raw page-size value from query string.
 * @returns Parsed page and page size values.
 */
export const parsePagination = (
  pageRaw: string | undefined,
  pageSizeRaw: string | undefined,
): { page: number; pageSize: number } => {
  const page = Math.max(1, Number.parseInt(pageRaw ?? "1", 10) || 1);
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(
      1,
      Number.parseInt(pageSizeRaw ?? String(DEFAULT_PAGE_SIZE), 10) ||
        DEFAULT_PAGE_SIZE,
    ),
  );
  return { page, pageSize };
};
