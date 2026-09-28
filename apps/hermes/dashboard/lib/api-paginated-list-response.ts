import { NextResponse } from "next/server";

export type PaginatedListBody<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
};

export const hasMoreListPages = (
  total: number,
  page: number,
  pageSize: number,
): boolean => page * pageSize < total;

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
    hasMore: hasMoreListPages(total, page, pageSize),
  } satisfies PaginatedListBody<T>);
