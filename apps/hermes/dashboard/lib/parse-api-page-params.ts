/** Default page size for dashboard MCP list APIs. */
export const DEFAULT_API_PAGE_SIZE = 20;

/** Maximum allowed page size for dashboard MCP list APIs. */
export const MAX_API_PAGE_SIZE = 100;

export type ApiPageParams = {
  page: number;
  pageSize: number;
};

/**
 * Parses `page` and `pageSize` query params from a list API request URL.
 *
 * @param request - Incoming HTTP request.
 * @param defaults - Optional overrides for default page and page size.
 * @returns Normalized 1-based page and clamped page size.
 */
export const parseApiPageParams = (
  request: Request,
  defaults?: Partial<ApiPageParams>,
): ApiPageParams => {
  const url = new URL(request.url);
  const defaultPage = defaults?.page ?? 1;
  const defaultPageSize = defaults?.pageSize ?? DEFAULT_API_PAGE_SIZE;

  const pageRaw = url.searchParams.get("page");
  const pageSizeRaw = url.searchParams.get("pageSize");

  const page = Math.max(
    1,
    parseInt(pageRaw ?? String(defaultPage), 10) || defaultPage,
  );
  const pageSize = Math.min(
    MAX_API_PAGE_SIZE,
    Math.max(
      1,
      parseInt(pageSizeRaw ?? String(defaultPageSize), 10) || defaultPageSize,
    ),
  );

  return { page, pageSize };
};
