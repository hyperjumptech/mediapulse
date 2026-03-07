"use client";

import Link from "next/link";

import { Button } from "@workspace/ui/components/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

type ExecutionsPaginationProps = {
  scheduleId: string;
  page: number;
  pageSize: number;
  total: number;
};

/**
 * Builds query string for executions pagination (page and size only).
 */
const buildQueryString = (page: number, pageSize: number): string => {
  const params = new URLSearchParams();
  params.set("page", String(page));
  params.set("size", String(pageSize));
  return params.toString();
};

/**
 * Prev/Next pagination links for the schedule executions table.
 */
export const ExecutionsPagination = ({
  scheduleId,
  page,
  pageSize,
  total,
}: ExecutionsPaginationProps) => {
  const basePath = `/dashboard/schedules/${scheduleId}`;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const hasPrev = page > 1;
  const hasNext = page < totalPages;

  const prevHref = hasPrev
    ? `${basePath}?${buildQueryString(page - 1, pageSize)}`
    : undefined;
  const nextHref = hasNext
    ? `${basePath}?${buildQueryString(page + 1, pageSize)}`
    : undefined;

  if (totalPages <= 1 && total <= pageSize) {
    return null;
  }

  return (
    <nav
      className="flex items-center justify-between gap-2"
      aria-label="Executions pagination"
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
