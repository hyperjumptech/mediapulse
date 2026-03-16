"use client";

import Link from "next/link";

import { Button } from "@workspace/ui/components/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

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
};

/**
 * Builds pagination query string from page, size, and optional search/sort.
 *
 * @param page - 1-based page number.
 * @param pageSize - Items per page.
 * @param options - Optional searchQuery, sortBy, sortDir.
 * @returns URL search params string (without leading ?).
 */
const buildQueryString = (
  page: number,
  pageSize: number,
  options: {
    searchQuery?: string;
    sortBy?: string;
    sortDir?: string;
  },
): string => {
  const params = new URLSearchParams();
  params.set("page", String(page));
  params.set("size", String(pageSize));
  if (options.searchQuery) params.set("q", options.searchQuery);
  if (options.sortBy) params.set("sort", options.sortBy);
  if (options.sortDir) params.set("dir", options.sortDir);
  return params.toString();
};

/**
 * Reusable prev/next list pagination. Hides when a single page. Preserves search and sort in links.
 */
export const ListPagination = ({
  basePath,
  page,
  pageSize,
  total,
  ariaLabel,
  searchQuery,
  sortBy,
  sortDir,
}: ListPaginationProps) => {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const hasPrev = page > 1;
  const hasNext = page < totalPages;

  const opts = { searchQuery, sortBy, sortDir };
  const prevHref = hasPrev
    ? `${basePath}?${buildQueryString(page - 1, pageSize, opts)}`
    : undefined;
  const nextHref = hasNext
    ? `${basePath}?${buildQueryString(page + 1, pageSize, opts)}`
    : undefined;

  if (totalPages <= 1 && total <= pageSize) {
    return null;
  }

  return (
    <nav
      className="flex items-center justify-between gap-2"
      aria-label={ariaLabel}
    >
      <Button variant="outline" size="sm" asChild disabled={!hasPrev}>
        {prevHref ? (
          <Link href={prevHref} aria-label="Previous page">
            <ChevronLeft className="size-4" />
            Previous
          </Link>
        ) : (
          <span>
            <ChevronLeft className="size-4" />
            Previous
          </span>
        )}
      </Button>
      <span className="text-sm text-muted-foreground">
        Page {page} of {totalPages} ({total} total)
      </span>
      <Button variant="outline" size="sm" asChild disabled={!hasNext}>
        {nextHref ? (
          <Link href={nextHref} aria-label="Next page">
            Next
            <ChevronRight className="size-4" />
          </Link>
        ) : (
          <span>
            Next
            <ChevronRight className="size-4" />
          </span>
        )}
      </Button>
    </nav>
  );
};
