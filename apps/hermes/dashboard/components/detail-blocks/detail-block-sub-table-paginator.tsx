"use client";

import type { DetailBlockSubTableColumn } from "@hermes/domain-contract";

import { Button } from "@workspace/ui/components/button";

import { DetailBlockSubTableContent } from "./detail-block-sub-table";
import { usePaginatedItems } from "./use-paginated-items";

/**
 * Client-side paginated sub-table. Slices the provided `rows` array by
 * `pageSize` and exposes prev/next controls plus a "Showing X–Y of Z" label.
 *
 * The caller has already filtered `rows` to objects, evaluated section rules,
 * and rendered the caption — the paginator only handles the visible window
 * and its controls.
 */
export const DetailBlockSubTablePaginator = ({
  columns,
  rows,
  rowContext,
  pageSize,
}: {
  columns: readonly DetailBlockSubTableColumn[];
  rows: readonly Record<string, unknown>[];
  rowContext: unknown;
  pageSize: number;
}) => {
  const {
    visible,
    page,
    totalPages,
    canGoBack,
    canGoForward,
    goBack,
    goForward,
    rangeLabel,
  } = usePaginatedItems(rows, pageSize);

  const unit = rows.length === 1 ? "item" : "items";

  return (
    <div className="flex flex-col gap-3">
      <DetailBlockSubTableContent
        columns={columns}
        rows={visible}
        rowContext={rowContext}
      />
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
        <span aria-live="polite">
          Showing {rangeLabel} {unit}
        </span>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!canGoBack}
            onClick={goBack}
          >
            Previous
          </Button>
          <span>
            Page {page + 1} of {totalPages}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!canGoForward}
            onClick={goForward}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
};
