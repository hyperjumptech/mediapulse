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
  DataTableSort,
} from "@/lib/data-table/features";
import {
  buildClearSearchHref,
  buildSortHref,
  type ListUrlState,
} from "@/lib/data-table/list-url-state";

import { DataTableCard } from "./data-table-card";
import {
  DataTableColumnHeader,
  type ColumnSortDirection,
  type ColumnSortTargets,
} from "./data-table-column-header";
import { DataTableMobileList } from "./data-table-mobile-list";
import { DataTableSearch } from "./data-table-search";
import { DataTableViewOptions } from "./data-table-view-options";

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
  clientSorting?: { initial?: DataTableSort };
  paginationLabel?: string;
  search?: { label: string; placeholder: string };
  toolbarActions?: ReactNode;
  toolbarFilters?: ReactNode;
  emptyState: DataTableEmptyState;
  initialColumnVisibility?: ColumnVisibility;
  hideHeader?: boolean;
  getSectionHeading?: (row: Row) => string | null;
};

const HIDE_BELOW_CLASS: Record<DataTableBreakpoint, string> = {
  sm: "hidden sm:table-cell",
  md: "hidden md:table-cell",
  lg: "hidden lg:table-cell",
  xl: "hidden xl:table-cell",
};

type HeaderSort = {
  activeDirection: ColumnSortDirection | null;
  targets: ColumnSortTargets;
};

type SortableColumn = {
  getIsSorted: () => false | ColumnSortDirection;
  toggleSorting: (desc?: boolean) => void;
};

const headerSortFor = (
  column: SortableColumn,
  sortKey: string | undefined,
  urlState: ListUrlState | undefined,
  clientSorting: boolean,
): HeaderSort | null => {
  if (!sortKey) {
    return null;
  }
  if (urlState) {
    return {
      activeDirection: urlState.sortBy === sortKey ? urlState.sortDir : null,
      targets: {
        kind: "link",
        ascHref: buildSortHref(urlState, sortKey, "asc"),
        descHref: buildSortHref(urlState, sortKey, "desc"),
      },
    };
  }
  if (!clientSorting) {
    return null;
  }

  return {
    activeDirection: column.getIsSorted() || null,
    targets: {
      kind: "client",
      onSort: (direction) => column.toggleSorting(direction === "desc"),
    },
  };
};

const ariaSortFor = (headerSort: HeaderSort | null) => {
  if (!headerSort?.activeDirection) {
    return undefined;
  }

  return headerSort.activeDirection === "asc" ? "ascending" : "descending";
};

const minWidthStyle = (minWidth: number | undefined) =>
  minWidth ? { minWidth } : undefined;

const SectionHeadingRow = ({
  heading,
  columnCount,
}: {
  heading: string;
  columnCount: number;
}) => (
  <TableRow className="bg-muted/50 hover:bg-muted/50">
    <TableCell colSpan={columnCount} className="px-4 font-semibold">
      {heading}
    </TableCell>
  </TableRow>
);

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
  clientSorting,
  paginationLabel,
  search,
  toolbarActions,
  toolbarFilters,
  emptyState,
  initialColumnVisibility,
  hideHeader = false,
  getSectionHeading,
}: DataTableProps<Row>) => {
  const table = useDataTable({
    tableId,
    columns,
    rows,
    getRowId,
    initialColumnVisibility,
    initialSorting: clientSorting?.initial ? [clientSorting.initial] : [],
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
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-1 flex-wrap items-center gap-2">
            {search && urlState ? (
              <DataTableSearch
                tableId={tableId}
                urlState={urlState}
                label={search.label}
                placeholder={search.placeholder}
              />
            ) : null}
            {toolbarFilters}
          </div>
          <div className="ml-auto flex shrink-0 flex-wrap items-center gap-2">
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
              {hideHeader ? null : (
                <TableHeader>
                  {table.getHeaderGroups().map((headerGroup) => (
                    <TableRow
                      key={headerGroup.id}
                      className="hover:bg-transparent"
                    >
                      {headerGroup.headers.map((header, index) => {
                        const meta = header.column.columnDef.meta;
                        const headerSort = headerSortFor(
                          header.column,
                          meta?.sortKey,
                          urlState,
                          Boolean(clientSorting),
                        );
                        const isLast = index === headerGroup.headers.length - 1;

                        return (
                          <TableHead
                            key={header.id}
                            aria-sort={ariaSortFor(headerSort)}
                            style={minWidthStyle(meta?.minWidth)}
                            className={cn(
                              index === 0 && "pl-4",
                              isLast && "pr-4",
                              meta?.mobile === "actions" && "w-0",
                              meta?.hideBelow &&
                                HIDE_BELOW_CLASS[meta.hideBelow],
                              meta?.headerClassName,
                            )}
                          >
                            {headerSort ? (
                              <DataTableColumnHeader
                                label={meta?.label ?? header.column.id}
                                activeDirection={headerSort.activeDirection}
                                targets={headerSort.targets}
                                onHide={
                                  header.column.getCanHide()
                                    ? () =>
                                        header.column.toggleVisibility(false)
                                    : undefined
                                }
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
              )}
              <TableBody>
                {tableRows.map((row) => {
                  const cells = row.getVisibleCells();
                  const sectionHeading =
                    getSectionHeading?.(row.original) ?? null;
                  if (sectionHeading !== null) {
                    return (
                      <SectionHeadingRow
                        key={row.id}
                        heading={sectionHeading}
                        columnCount={cells.length}
                      />
                    );
                  }

                  return (
                    <TableRow key={row.id}>
                      {cells.map((cell, index) => {
                        const meta = cell.column.columnDef.meta;
                        const isLast = index === cells.length - 1;

                        return (
                          <TableCell
                            key={cell.id}
                            style={minWidthStyle(meta?.minWidth)}
                            className={cn(
                              index === 0 && "pl-4",
                              isLast && meta?.mobile !== "actions" && "pr-4",
                              meta?.hideBelow &&
                                HIDE_BELOW_CLASS[meta.hideBelow],
                              meta?.cellClassName,
                            )}
                          >
                            <FlexRender cell={cell} />
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </DataTableCard>
          <DataTableMobileList
            rows={tableRows}
            getSectionHeading={getSectionHeading}
          />
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
