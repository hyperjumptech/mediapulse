"use client";

import Link from "next/link";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";

import {
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table";

import type { DomainTableColumnForDisplay } from "./domain-table-page";

type DomainTableSortableHeaderProps = {
  columns: DomainTableColumnForDisplay[];
  sortableFields: string[];
  sortBy?: string;
  sortDir: "asc" | "desc";
  basePath: string;
  pageSize: number;
  searchQuery?: string;
  preserveParams?: Record<string, string>;
  hasRowActions: boolean;
};

/**
 * Builds a list URL with sort (resets to page 1 when sort changes).
 */
const buildSortHref = (
  basePath: string,
  sortBy: string,
  sortDir: "asc" | "desc",
  pageSize: number,
  searchQuery?: string,
  preserveParams?: Record<string, string>,
): string => {
  const params = new URLSearchParams();
  params.set("page", "1");
  params.set("size", String(pageSize));
  if (searchQuery) params.set("q", searchQuery);
  params.set("sort", sortBy);
  params.set("dir", sortDir);
  for (const [key, value] of Object.entries(preserveParams ?? {})) {
    params.set(key, value);
  }
  return `${basePath}?${params.toString()}`;
};

/**
 * Renders table column headers with sort links for manifest `sortableFields`.
 */
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
  const sortLink = (field: string, label: string) => {
    const isActive = sortBy === field;
    const nextDir: "asc" | "desc" =
      isActive && sortDir === "asc" ? "desc" : "asc";
    const href = buildSortHref(
      basePath,
      field,
      isActive ? nextDir : "asc",
      pageSize,
      searchQuery,
      preserveParams,
    );
    const Icon = isActive
      ? sortDir === "asc"
        ? ArrowUp
        : ArrowDown
      : ArrowUpDown;

    return (
      <Link
        href={href}
        className="inline-flex items-center gap-1 font-medium hover:text-foreground"
        aria-sort={
          isActive
            ? sortDir === "asc"
              ? "ascending"
              : "descending"
            : undefined
        }
      >
        {label}
        <Icon className="size-4 shrink-0 opacity-70" aria-hidden />
      </Link>
    );
  };

  return (
    <TableHeader className="bg-muted/50">
      <TableRow className="border-muted hover:bg-transparent">
        {columns.map((column) => (
          <TableHead key={column.key}>
            {sortableFields.includes(column.key)
              ? sortLink(column.key, column.label)
              : column.label}
          </TableHead>
        ))}
        {hasRowActions ? <TableHead className="w-12" /> : null}
      </TableRow>
    </TableHeader>
  );
};
