"use client";

import Link from "next/link";

import { Button } from "@workspace/ui/components/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { TickerSortDir, TickerSortField } from "@/lib/tickers";

type PaginationProps = {
  basePath: string;
  page: number;
  pageSize: number;
  total: number;
  /** Optional search query to preserve in prev/next links. */
  searchQuery?: string;
  /** Sort field to preserve in prev/next links. */
  sortBy: TickerSortField;
  /** Sort direction to preserve in prev/next links. */
  sortDir: TickerSortDir;
};

/**
 * Prev/Next pagination links for the tickers list. Disables Prev on first page and Next on last page.
 */
/**
 * Builds pagination query string including optional search and sort.
 */
const buildQueryString = (
  page: number,
  pageSize: number,
  searchQuery: string | undefined,
  sortBy: TickerSortField,
  sortDir: TickerSortDir,
): string => {
  const params = new URLSearchParams();
  params.set("page", String(page));
  params.set("size", String(pageSize));
  if (searchQuery) params.set("q", searchQuery);
  params.set("sort", sortBy);
  params.set("dir", sortDir);
  return params.toString();
};

export const Pagination = ({
  basePath,
  page,
  pageSize,
  total,
  searchQuery,
  sortBy,
  sortDir,
}: PaginationProps) => {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const hasPrev = page > 1;
  const hasNext = page < totalPages;

  const prevHref = hasPrev
    ? `${basePath}?${buildQueryString(page - 1, pageSize, searchQuery, sortBy, sortDir)}`
    : undefined;
  const nextHref = hasNext
    ? `${basePath}?${buildQueryString(page + 1, pageSize, searchQuery, sortBy, sortDir)}`
    : undefined;

  if (totalPages <= 1 && total <= pageSize) {
    return null;
  }

  return (
    <nav
      className="flex items-center justify-between gap-2"
      aria-label="Tickers list pagination"
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
