import {
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table";

import { SortableHeader } from "@/components/data-table/sortable-header";
import {
  buildListHref,
  nextSortDirection,
  type SortDirection,
} from "@/lib/list-page-params";

import type { DomainTableColumnForDisplay } from "./domain-table-rows-section";

type DomainTableSortableHeaderProps = {
  columns: DomainTableColumnForDisplay[];
  sortableFields: string[];
  sortBy?: string;
  sortDir: SortDirection;
  basePath: string;
  pageSize: number;
  searchQuery?: string;
  preserveParams?: Record<string, string>;
  hasRowActions: boolean;
};

export const DomainTableSortableHeader = ({
  columns,
  sortableFields,
  sortBy,
  sortDir,
  basePath,
  pageSize,
  searchQuery,
  preserveParams,
  hasRowActions,
}: DomainTableSortableHeaderProps) => {
  const activeSortField = sortBy ?? "";

  return (
    <TableHeader>
      <TableRow className="hover:bg-transparent">
        {columns.map((column, columnIndex) => {
          const isFirstColumn = columnIndex === 0;
          const headClassName = isFirstColumn ? "pl-4" : undefined;

          if (!sortableFields.includes(column.key)) {
            return (
              <TableHead key={column.key} className={headClassName}>
                {column.label}
              </TableHead>
            );
          }

          const direction = nextSortDirection(
            column.key,
            activeSortField,
            sortDir,
          );
          const href = buildListHref(basePath, {
            pageSize,
            search: searchQuery,
            sortBy: column.key,
            sortDir: direction,
            extra: preserveParams,
          });

          return (
            <TableHead key={column.key} className={headClassName}>
              <SortableHeader
                label={column.label}
                href={href}
                isActive={column.key === activeSortField}
                direction={sortDir}
              />
            </TableHead>
          );
        })}
        {hasRowActions ? (
          <TableHead className="w-12 pr-2">
            <span className="sr-only">Actions</span>
          </TableHead>
        ) : null}
      </TableRow>
    </TableHeader>
  );
};
