"use client";

import Link from "next/link";

import { Button } from "@workspace/ui/components/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

type PaginationProps = {
  basePath: string;
  page: number;
  pageSize: number;
  total: number;
};

/**
 * Prev/Next pagination links for the tickers list. Disables Prev on first page and Next on last page.
 */
export const Pagination = ({
  basePath,
  page,
  pageSize,
  total,
}: PaginationProps) => {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const hasPrev = page > 1;
  const hasNext = page < totalPages;

  const prevHref = hasPrev
    ? `${basePath}?page=${page - 1}&size=${pageSize}`
    : undefined;
  const nextHref = hasNext
    ? `${basePath}?page=${page + 1}&size=${pageSize}`
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
