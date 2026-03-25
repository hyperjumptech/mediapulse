"use client";

import Link from "next/link";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table";
import { Badge } from "@workspace/ui/components/badge";

import { VariableRowActions } from "./variable-row-actions";
import { format } from "date-fns";
import type {
  VariablesPageResult,
  VariableSortDir,
  VariableSortField,
} from "@/lib/variables";
import { formatCreatedBy } from "@/lib/format-created-by";

type VariableRow = VariablesPageResult["variables"][number];

const BASE_PATH = "/dashboard/variables";

/**
 * Builds variables list URL with sort (resets to page 1 when sort changes).
 */
const buildSortHref = (
  sortBy: VariableSortField,
  sortDir: VariableSortDir,
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

type VariablesTableProps = {
  variables: VariableRow[];
  sortBy: VariableSortField;
  sortDir: VariableSortDir;
  pageSize: number;
  searchQuery?: string;
  /** When provided, Edit opens the edit modal via this callback. */
  onEdit?: (variable: VariableRow) => void;
};

/**
 * Renders the variables list as a table with sortable Key, Value (masked if secret), Note, Secret, Created columns and row actions.
 */
export const VariablesTable = ({
  variables,
  sortBy,
  sortDir,
  pageSize,
  searchQuery,
  onEdit,
}: VariablesTableProps) => {
  const sortLink = (field: VariableSortField, label: string) => {
    const isActive = sortBy === field;
    const nextDir: VariableSortDir =
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
              {sortLink("key", "Key")}
            </TableHead>
            <TableHead className="w-[200px]">Value</TableHead>
            <TableHead className="w-[200px]">Note</TableHead>
            <TableHead className="w-[80px]">Secret</TableHead>
            <TableHead className="w-[120px]">
              {sortLink("created", "Created")}
            </TableHead>
            <TableHead className="w-[180px]">Created by</TableHead>
            <TableHead className="w-12" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {variables.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={7}
                className="text-center text-muted-foreground"
              >
                No variables yet.
              </TableCell>
            </TableRow>
          ) : (
            variables.map((variable) => (
              <TableRow key={variable.id}>
                <TableCell className="font-medium">
                  {onEdit ? (
                    <button
                      type="button"
                      onClick={() => onEdit(variable)}
                      className="text-left underline decoration-muted-foreground/40 underline-offset-2 hover:decoration-foreground hover:text-foreground"
                    >
                      {variable.key}
                    </button>
                  ) : (
                    variable.key
                  )}
                </TableCell>
                <TableCell className="font-mono text-sm text-muted-foreground">
                  {variable.value}
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {variable.note ?? "—"}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={variable.isSecret ? "secondary" : "outline"}
                    className="font-normal"
                  >
                    {variable.isSecret ? "Yes" : "No"}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {format(variable.createdAt, "LLL d, yyyy")}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {formatCreatedBy(variable.createdBy)}
                </TableCell>
                <TableCell className="text-right">
                  <VariableRowActions
                    variable={variable}
                    variableLabel={variable.key}
                    onEdit={onEdit}
                  />
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
};
