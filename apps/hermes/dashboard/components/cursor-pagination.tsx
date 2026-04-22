"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@workspace/ui/components/button";

type CursorPaginationProps = {
  /** Base URL path (e.g. /dashboard/agents/content-generation-runs). */
  basePath: string;
  /** Cursor of the current page (from `cursor` search param). Undefined for the first page. */
  currentCursor?: string;
  /** Cursor for the previous page. Undefined when on the first page. */
  prevCursor?: string;
  /** Cursor for the next page. Undefined when there are no more results. */
  nextCursor?: string;
  /** Page size to preserve in links. */
  limit: number;
  /** Additional query params to preserve in links (e.g. filters). */
  extraParams?: Record<string, string>;
  /** Accessible label for the navigation element. */
  ariaLabel: string;
};

/**
 * Builds a URL query string preserving cursor, prevCursor, limit, and extra filter params.
 *
 * @param basePath - The base route path.
 * @param cursor - Cursor value for the page (undefined for first page).
 * @param limit - Page size.
 * @param extraParams - Additional query parameters to preserve.
 * @param prevCursor - Previous-page cursor to preserve for backward navigation.
 * @returns Full URL with query string.
 */
const buildCursorUrl = (
  basePath: string,
  cursor: string | undefined,
  limit: number,
  extraParams?: Record<string, string>,
  prevCursor?: string,
): string => {
  const params = new URLSearchParams();
  if (cursor) params.set("cursor", cursor);
  if (prevCursor) params.set("prevCursor", prevCursor);
  params.set("limit", String(limit));
  for (const [key, value] of Object.entries(extraParams ?? {})) {
    if (value) params.set(key, value);
  }
  return `${basePath}?${params.toString()}`;
};

/**
 * Cursor-based pagination for API-driven list pages.
 * Renders "Previous" and "Next" links that preserve filter params in the URL.
 * The "Next" link carries the current cursor as `prevCursor` so that the
 * subsequent page's "Previous" button navigates back one step instead of
 * resetting to page 1.
 *
 * @param props - Component props.
 * @returns Navigation element with prev/next links, or null when only one page exists.
 */
export const CursorPagination = ({
  basePath,
  currentCursor,
  prevCursor,
  nextCursor,
  limit,
  extraParams,
  ariaLabel,
}: CursorPaginationProps) => {
  const hasPrev = Boolean(currentCursor);
  const hasNext = Boolean(nextCursor);

  if (!hasPrev && !hasNext) {
    return null;
  }

  const prevHref = hasPrev
    ? buildCursorUrl(
        basePath,
        prevCursor,
        limit,
        extraParams,
      )
    : undefined;

  const nextHref = hasNext
    ? buildCursorUrl(
        basePath,
        nextCursor,
        limit,
        extraParams,
        currentCursor,
      )
    : undefined;

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
