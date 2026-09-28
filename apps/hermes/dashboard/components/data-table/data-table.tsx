"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { FlexRender, type RowData } from "@tanstack/react-table";
import { SearchX, type LucideIcon } from "lucide-react";

import { Button } from "@workspace/ui/components/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@workspace/ui/components/empty";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table";
import { cn } from "@workspace/ui/lib/utils";

import { ListPagination } from "@/components/list-pagination";
import { useDataTable } from "@/hooks/use-data-table";
import type { ColumnVisibility } from "@/lib/data-table/column-visibility";
import type {
  DataTableBreakpoint,
  DataTableColumns,
} from "@/lib/data-table/features";
import {
  buildClearSearchHref,
  buildSortHref,
  type ListUrlState,
} from "@/lib/data-table/list-url-state";

import { DataTableCard } from "./data-table-card";
import { DataTableMobileList } from "./data-table-mobile-list";
import { DataTableSearch } from "./data-table-search";
import { DataTableViewOptions } from "./data-table-view-options";
import { SortableHeader } from "./sortable-header";

export type DataTableEmptyState = {
  title: string;
  description?: string;
  icon: LucideIcon;
  action?: ReactNode;
};

export type DataTableProps<Row extends RowData> = {
  tableId: string;
  columns: DataTableColumns<Row>;
  rows: Row[];
  getRowId: (row: Row) => string;
  urlState?: ListUrlState;
  paginationLabel?: string;
  search?: { label: string; placeholder: string };
  toolbarActions?: ReactNode;
  toolbarFilters?: ReactNode;
  emptyState: DataTableEmptyState;
  initialColumnVisibility?: ColumnVisibility;
};

const HIDE_BELOW_CLASS: Record<DataTableBreakpoint, string> = {
  sm: "hidden sm:table-cell",
  md: "hidden md:table-cell",
  lg: "hidden lg:table-cell",
  xl: "hidden xl:table-cell",
};

const EmptyResults = ({
  emptyState,
  urlState,
}: {
  emptyState: DataTableEmptyState;
  urlState?: ListUrlState;
}) => {
  if (urlState?.search) {
    return (
      <Empty className="gap-4 py-12 md:py-16">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <SearchX aria-hidden className="size-5 text-muted-foreground" />
          </EmptyMedia>
          <EmptyTitle className="text-base">
            Nothing matches “{urlState.search}”
          </EmptyTitle>
          <EmptyDescription>Try a different search.</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button variant="outline" size="sm" asChild>
            <Link href={buildClearSearchHref(urlState)}>Clear search</Link>
          </Button>
        </EmptyContent>
      </Empty>
    );
  }
  const Icon = emptyState.icon;

  return (
    <Empty className="gap-4 py-12 md:py-16">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Icon aria-hidden className="size-5 text-muted-foreground" />
        </EmptyMedia>
        <EmptyTitle className="text-base">{emptyState.title}</EmptyTitle>
        {emptyState.description ? (
          <EmptyDescription>{emptyState.description}</EmptyDescription>
        ) : null}
      </EmptyHeader>
      {emptyState.action ? (
        <EmptyContent>{emptyState.action}</EmptyContent>
      ) : null}
    </Empty>
  );
};

export const DataTable = <Row extends RowData>({
  tableId,
  columns,
  rows,
  getRowId,
  urlState,
  paginationLabel,
  search,
  toolbarActions,
  toolbarFilters,
  emptyState,
  initialColumnVisibility,
}: DataTableProps<Row>) => {
  const table = useDataTable({
    tableId,
    columns,
    rows,
    getRowId,
    initialColumnVisibility,
  });
  const tableRows = table.getRowModel().rows;
  const hasMobileToolbar = Boolean(
    (search && urlState) || toolbarFilters || toolbarActions,
  );
  const showViewOptions =
    tableRows.length > 0 &&
    table.getAllColumns().some((column) => column.getCanHide());
  const hasToolbar = hasMobileToolbar || showViewOptions;

  return (
    <div className="flex flex-col gap-4">
      {hasToolbar ? (
        <div
          className={cn(
            "flex flex-col gap-3 md:flex-row md:items-center",
            !hasMobileToolbar && "hidden md:flex",
          )}
        >
          {search && urlState ? (
            <DataTableSearch
              tableId={tableId}
              urlState={urlState}
              label={search.label}
              placeholder={search.placeholder}
            />
          ) : null}
          {toolbarFilters}
          <div className="flex items-center gap-2 md:ml-auto">
            {showViewOptions ? <DataTableViewOptions table={table} /> : null}
            {toolbarActions}
          </div>
        </div>
      ) : null}

      {tableRows.length === 0 ? (
        <DataTableCard>
          <EmptyResults emptyState={emptyState} urlState={urlState} />
        </DataTableCard>
      ) : (
        <>
          <DataTableCard className="hidden md:block">
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow
                    key={headerGroup.id}
                    className="hover:bg-transparent"
                  >
                    {headerGroup.headers.map((header, index) => {
                      const meta = header.column.columnDef.meta;
                      const sortKey = meta?.sortKey;

                      return (
                        <TableHead
                          key={header.id}
                          className={cn(
                            index === 0 && "pl-4",
                            meta?.hideBelow && HIDE_BELOW_CLASS[meta.hideBelow],
                            meta?.headerClassName,
                          )}
                        >
                          {sortKey && urlState ? (
                            <SortableHeader
                              label={meta?.label ?? header.column.id}
                              href={buildSortHref(urlState, sortKey)}
                              isActive={urlState.sortBy === sortKey}
                              direction={urlState.sortDir}
                            />
                          ) : meta?.mobile === "actions" ? (
                            <span className="sr-only">{meta.label}</span>
                          ) : (
                            (meta?.label ?? <FlexRender header={header} />)
                          )}
                        </TableHead>
                      );
                    })}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {tableRows.map((row) => (
                  <TableRow key={row.id}>
                    {row.getVisibleCells().map((cell, index) => {
                      const meta = cell.column.columnDef.meta;

                      return (
                        <TableCell
                          key={cell.id}
                          className={cn(
                            index === 0 && "pl-4",
                            meta?.hideBelow && HIDE_BELOW_CLASS[meta.hideBelow],
                            meta?.cellClassName,
                          )}
                        >
                          <FlexRender cell={cell} />
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </DataTableCard>
          <DataTableMobileList rows={tableRows} />
        </>
      )}

      {urlState && paginationLabel ? (
        <ListPagination
          basePath={urlState.basePath}
          page={urlState.page}
          pageSize={urlState.pageSize}
          total={urlState.total}
          ariaLabel={paginationLabel}
          searchQuery={urlState.search}
          sortBy={urlState.sortBy}
          sortDir={urlState.sortDir}
          extraParams={urlState.extra}
        />
      ) : null}
    </div>
  );
};
