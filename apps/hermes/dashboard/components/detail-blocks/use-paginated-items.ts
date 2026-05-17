"use client";

import { useState } from "react";

/** Result returned by {@link usePaginatedItems}. */
export type UsePaginatedItemsReturn<T> = {
  /** Items belonging to the current page (in original order). */
  visible: readonly T[];
  /** Zero-based current page index, clamped to a valid range. */
  page: number;
  /** Total number of pages (at least 1, even when the list is empty). */
  totalPages: number;
  /** Whether the user can move one page back. */
  canGoBack: boolean;
  /** Whether the user can move one page forward. */
  canGoForward: boolean;
  /** Move one page back if possible. No-op at the start. */
  goBack: () => void;
  /** Move one page forward if possible. No-op at the end. */
  goForward: () => void;
  /** Human-readable range label, e.g. "1–10 of 25". */
  rangeLabel: string;
};

/**
 * Client-side pagination state for a fixed list of items. Encapsulates the
 * `useState` for the current page so consuming components stay declarative
 * — see the `react-custom-hooks` rule.
 *
 * @param items - Full list of items to paginate.
 * @param pageSize - Maximum items per page; clamped to >= 1.
 * @returns Visible slice plus prev/next handlers and a range label.
 */
export const usePaginatedItems = <T>(
  items: readonly T[],
  pageSize: number,
): UsePaginatedItemsReturn<T> => {
  const [page, setPage] = useState(0);
  const safePageSize = Math.max(1, Math.floor(pageSize));
  const totalPages = Math.max(1, Math.ceil(items.length / safePageSize));
  const clampedPage = Math.min(Math.max(page, 0), totalPages - 1);
  const start = clampedPage * safePageSize;
  const end = Math.min(start + safePageSize, items.length);
  const visible = items.slice(start, end);

  return {
    visible,
    page: clampedPage,
    totalPages,
    canGoBack: clampedPage > 0,
    canGoForward: clampedPage < totalPages - 1,
    goBack: () => setPage((value) => Math.max(0, value - 1)),
    goForward: () => setPage((value) => Math.min(totalPages - 1, value + 1)),
    rangeLabel:
      items.length === 0 ? "0 of 0" : `${start + 1}–${end} of ${items.length}`,
  };
};
