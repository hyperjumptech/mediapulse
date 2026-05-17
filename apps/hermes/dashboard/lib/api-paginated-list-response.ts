import { NextResponse } from "next/server";

/** JSON body shape for paginated MCP list endpoints. */
export type PaginatedListBody<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
};

/**
 * Builds a JSON response for a paginated list endpoint.
 *
 * @param items - Rows for the current page.
 * @param total - Total row count across all pages.
 * @param page - 1-based current page.
 * @param pageSize - Requested page size.
 * @returns `NextResponse` with `{ items, total, page, pageSize }`.
 */
export const paginatedListJsonResponse = <T>(
  items: T[],
  total: number,
  page: number,
  pageSize: number,
): NextResponse =>
  NextResponse.json({
    items,
    total,
    page,
    pageSize,
  } satisfies PaginatedListBody<T>);
