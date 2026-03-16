"use client";

import Link from "next/link";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { format } from "date-fns";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table";

import { DataSourceExpansionRowActions } from "./data-source-expansion-row-actions";
import type {
  DataSourceExpansionSortDir,
  DataSourceExpansionSortField,
  DataSourceExpansionsPageResult,
} from "@/lib/data-source-expansions";

type DataSourceExpansionRow =
  DataSourceExpansionsPageResult["expansions"][number];

const BASE_PATH = "/dashboard/data-source-expansions";

const TRUNCATE_LEN = 50;

/**
 * Truncates a string with ellipsis if longer than maxLen.
 */
const truncate = (s: string, maxLen: number): string =>
  s.length <= maxLen ? s : `${s.slice(0, maxLen)}…`;

const buildSortHref = (
  sortBy: DataSourceExpansionSortField,
  sortDir: DataSourceExpansionSortDir,
  pageSize: number,
  searchQuery?: string,
): string => {
  const params = new URLSearchParams();
  params.set("page", "1");
  params.set("size", String(pageSize));
  if (searchQuery) params.set("q", searchQuery);
  params.set("sort", sortBy);
  params.set("dir", sortDir);
  return `${BASE_PATH}?${params.toString()}`;
};

type DataSourceExpansionsTableProps = {
  expansions: DataSourceExpansionRow[];
  sortBy: DataSourceExpansionSortField;
  sortDir: DataSourceExpansionSortDir;
  pageSize: number;
  searchQuery?: string;
};

/**
 * Renders the data source expansions list as a table with sortable columns and row actions (Edit, Delete).
 */
export const DataSourceExpansionsTable = ({
  expansions,
  sortBy,
  sortDir,
  pageSize,
  searchQuery,
}: DataSourceExpansionsTableProps) => {
  const sortLink = (field: DataSourceExpansionSortField, label: string) => {
    const isActive = sortBy === field;
    const nextDir: DataSourceExpansionSortDir =
      isActive && sortDir === "asc" ? "desc" : "asc";
    const href = buildSortHref(
      field,
      isActive ? nextDir : "asc",
      pageSize,
      searchQuery,
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
    <div className="rounded-md border">
      <Table>
        <TableHeader className="bg-muted/50">
          <TableRow className="border-muted hover:bg-transparent">
            <TableHead className="w-[180px]">
              {sortLink("name", "Name")}
            </TableHead>
            <TableHead className="max-w-[280px]">Expansion string</TableHead>
            <TableHead className="max-w-[200px]">Description</TableHead>
            <TableHead className="w-[120px]">
              {sortLink("created", "Created")}
            </TableHead>
            <TableHead className="w-12" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {expansions.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={5}
                className="text-center text-muted-foreground"
              >
                No data source expansions yet.
              </TableCell>
            </TableRow>
          ) : (
            expansions.map((expansion) => (
              <TableRow key={expansion.id}>
                <TableCell className="font-medium">
                  <Link
                    href={`/dashboard/data-source-expansions/${expansion.id}`}
                    className="underline decoration-muted-foreground/40 underline-offset-2 hover:decoration-foreground hover:text-foreground"
                  >
                    {expansion.name}
                  </Link>
                </TableCell>
                <TableCell className="font-mono text-sm text-muted-foreground">
                  {truncate(expansion.expansionString, TRUNCATE_LEN)}
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {expansion.description
                    ? truncate(expansion.description, TRUNCATE_LEN)
                    : "—"}
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {format(expansion.createdAt, "LLL d, yyyy")}
                </TableCell>
                <TableCell className="text-right">
                  <DataSourceExpansionRowActions expansion={expansion} />
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
};
