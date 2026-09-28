"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

import { PaginationStepButton } from "./pagination-step-button";

export type ListPaginationProps = {
  /** Base URL path (e.g. /dashboard/variables). Query string is appended. */
  basePath: string;
  page: number;
  pageSize: number;
  total: number;
  /** Accessible label for the nav (e.g. "Variables list pagination"). */
  ariaLabel: string;
  /** Optional search query to preserve in prev/next links. */
  searchQuery?: string;
  /** Optional sort field to preserve in prev/next links. */
  sortBy?: string;
  /** Optional sort direction to preserve in prev/next links. */
  sortDir?: string;
  /** Optional arbitrary query params to preserve in prev/next links. */
  extraParams?: Record<string, string>;
};

const countFormatter = new Intl.NumberFormat("en-US");

const buildQueryString = (
  page: number,
  pageSize: number,
  options: {
    searchQuery?: string;
    sortBy?: string;
    sortDir?: string;
    extraParams?: Record<string, string>;
  },
): string => {
  const params = new URLSearchParams();
  params.set("page", String(page));
  params.set("size", String(pageSize));
  if (options.searchQuery) {
    params.set("q", options.searchQuery);
  }
  if (options.sortBy) {
    params.set("sort", options.sortBy);
  }
  if (options.sortDir) {
    params.set("dir", options.sortDir);
  }
  for (const [key, value] of Object.entries(options.extraParams ?? {})) {
    params.set(key, value);
  }

  return params.toString();
};

export const describeVisibleRange = (
  page: number,
  pageSize: number,
  total: number,
): string => {
  const firstItem = (page - 1) * pageSize + 1;
  const lastItem = Math.min(page * pageSize, total);
  const formattedTotal = countFormatter.format(total);
  if (firstItem > total) {
    return `${formattedTotal} total`;
  }
  const formattedFirstItem = countFormatter.format(firstItem);
  const formattedLastItem = countFormatter.format(lastItem);

  return `Showing ${formattedFirstItem}–${formattedLastItem} of ${formattedTotal}`;
};

export const ListPagination = ({
  basePath,
  page,
  pageSize,
  total,
  ariaLabel,
  searchQuery,
  sortBy,
  sortDir,
  extraParams,
}: ListPaginationProps) => {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const hasPrevious = page > 1;
  const hasNext = page < totalPages;

  if (totalPages <= 1 && total <= pageSize) {
    return null;
  }

  const queryOptions = { searchQuery, sortBy, sortDir, extraParams };
  const previousHref = hasPrevious
    ? `${basePath}?${buildQueryString(page - 1, pageSize, queryOptions)}`
    : undefined;
  const nextHref = hasNext
    ? `${basePath}?${buildQueryString(page + 1, pageSize, queryOptions)}`
    : undefined;
  const visibleRange = describeVisibleRange(page, pageSize, total);

  return (
    <nav
      className="flex items-center justify-between gap-4"
      aria-label={ariaLabel}
    >
      <p className="text-sm text-muted-foreground tabular-nums">
        {visibleRange}
      </p>
      <div className="flex items-center gap-1.5">
        <PaginationStepButton
          href={previousHref}
          label="Previous page"
          rel="prev"
          icon={ChevronLeft}
        />
        <PaginationStepButton
          href={nextHref}
          label="Next page"
          rel="next"
          icon={ChevronRight}
        />
      </div>
    </nav>
  );
};
