import * as React from "react";

import { Button } from "@workspace/ui/components/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { usePickerTabListState } from "../hooks/use-picker-tab-list-state";
import type { LoadPageArgs } from "../types";

export type PickerTabListProps<TItem> = {
  /** Debounced search; parent should set `key={debouncedSearch}` on this component to reset pagination when search changes. */
  search: string;
  loadPage: (args: LoadPageArgs) => Promise<{ items: TItem[]; total: number }>;
  pageSize: number;
  enabled: boolean;
  /** Stable React key for each item. */
  getItemKey: (item: TItem) => string;
  /** Renders one row; clicking should invoke the action for that item. */
  renderRow: (item: TItem) => React.ReactNode;
  emptyLabel: string;
  "aria-label"?: string;
};

/**
 * Paginated list with prev/next for one picker tab.
 *
 * @param props - Search, loader, page size, enabled flag, row renderer, empty label.
 * @returns List UI with pagination controls.
 */
export const PickerTabList = <TItem,>({
  search,
  loadPage,
  pageSize,
  enabled,
  getItemKey,
  renderRow,
  emptyLabel,
  "aria-label": ariaLabel,
}: PickerTabListProps<TItem>) => {
  const { page, setPage, items, loading, error, totalPages, hasPrev, hasNext } =
    usePickerTabListState(search, loadPage, pageSize, enabled);

  return (
    <div className="flex min-h-[12rem] flex-col gap-2" aria-busy={loading}>
      {loading ? (
        <p className="text-muted-foreground text-sm">Loading…</p>
      ) : null}
      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}
      {!loading && !error && items.length === 0 ? (
        <p className="text-muted-foreground text-sm">{emptyLabel}</p>
      ) : null}
      <ul
        className="max-h-[min(16rem,40vh)] min-h-0 flex-1 space-y-1 overflow-y-auto"
        aria-label={ariaLabel}
      >
        {items.map((item) => (
          <li key={getItemKey(item)}>{renderRow(item)}</li>
        ))}
      </ul>
      {totalPages > 1 ? (
        <div className="flex items-center justify-between gap-2 border-t pt-2">
          <span className="text-muted-foreground text-xs">
            Page {page} of {totalPages}
          </span>
          <div className="flex gap-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!hasPrev || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              aria-label="Previous page"
            >
              <ChevronLeft className="size-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!hasNext || loading}
              onClick={() => setPage((p) => p + 1)}
              aria-label="Next page"
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
};
