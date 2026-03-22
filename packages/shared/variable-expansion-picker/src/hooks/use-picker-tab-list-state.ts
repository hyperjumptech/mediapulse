import * as React from "react";

import type { LoadPageArgs } from "../types";

export type PickerTabListState<TItem> = {
  page: number;
  setPage: React.Dispatch<React.SetStateAction<number>>;
  items: TItem[];
  total: number;
  loading: boolean;
  error: string | null;
  totalPages: number;
  hasPrev: boolean;
  hasNext: boolean;
};

/**
 * Loads a single tab's paginated list when enabled; tracks page and loading/error.
 * Remount the consumer when `search` changes so page resets to 1 (use `key={debouncedSearch}` on parent).
 *
 * @param search - Debounced search string passed to the loader.
 * @param loadPage - Async loader returning items and total count.
 * @param pageSize - Items per page.
 * @param enabled - When false, skips network requests (e.g. modal closed or inactive tab).
 * @returns Pagination state and list data.
 */
export const usePickerTabListState = <TItem>(
  search: string,
  loadPage: (args: LoadPageArgs) => Promise<{ items: TItem[]; total: number }>,
  pageSize: number,
  enabled: boolean,
): PickerTabListState<TItem> => {
  const [page, setPage] = React.useState(1);
  const [items, setItems] = React.useState<TItem[]>([]);
  const [total, setTotal] = React.useState(0);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!enabled) {
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    void loadPage({ page, pageSize, search })
      .then((r) => {
        if (!cancelled) {
          setItems(r.items);
          setTotal(r.total);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, page, pageSize, search, loadPage]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return {
    page,
    setPage,
    items,
    total,
    loading,
    error,
    totalPages,
    hasPrev: page > 1,
    hasNext: page < totalPages,
  };
};
