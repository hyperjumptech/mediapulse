"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

import { PaginationStepButton } from "./pagination-step-button";

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

const buildCursorUrl = (
  basePath: string,
  cursor: string | undefined,
  limit: number,
  extraParams?: Record<string, string>,
  previousCursor?: string,
): string => {
  const params = new URLSearchParams();
  if (cursor) {
    params.set("cursor", cursor);
  }
  if (previousCursor) {
    params.set("prevCursor", previousCursor);
  }
  params.set("limit", String(limit));
  for (const [key, value] of Object.entries(extraParams ?? {})) {
    if (value) {
      params.set(key, value);
    }
  }

  return `${basePath}?${params.toString()}`;
};

export const CursorPagination = ({
  basePath,
  currentCursor,
  prevCursor,
  nextCursor,
  limit,
  extraParams,
  ariaLabel,
}: CursorPaginationProps) => {
  const hasPrevious = Boolean(currentCursor);
  const hasNext = Boolean(nextCursor);

  if (!hasPrevious && !hasNext) {
    return null;
  }

  const previousHref = hasPrevious
    ? buildCursorUrl(basePath, prevCursor, limit, extraParams)
    : undefined;
  const nextHref = hasNext
    ? buildCursorUrl(basePath, nextCursor, limit, extraParams, currentCursor)
    : undefined;

  return (
    <nav
      className="flex items-center justify-end gap-1.5"
      aria-label={ariaLabel}
    >
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
    </nav>
  );
};
