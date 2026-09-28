"use client";

import Link from "next/link";
import { Braces, Lock, Plus, SearchX } from "lucide-react";

import { Badge } from "@workspace/ui/components/badge";
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

import { CopyableId } from "@/components/copyable-id";
import { DataTableCard } from "@/components/data-table/data-table-card";
import { SortableHeader } from "@/components/data-table/sortable-header";
import { RelativeTime } from "@/components/relative-time";
import { formatCreatedBy } from "@/lib/format-created-by";
import { buildListHref, nextSortDirection } from "@/lib/list-page-params";
import type {
  VariablesPageResult,
  VariableSortDir,
  VariableSortField,
} from "@/lib/variables";

import { VariableModal } from "./variable-modal";
import { VariableRowActions } from "./variable-row-actions";

type VariableRow = VariablesPageResult["variables"][number];

type EditVariableHandler = (variable: VariableRow) => void;

const BASE_PATH = "/dashboard/variables";

type VariablesTableProps = {
  variables: VariableRow[];
  sortBy: VariableSortField;
  sortDir: VariableSortDir;
  pageSize: number;
  searchQuery?: string;
  onEdit?: EditVariableHandler;
};

const VariablesEmptyState = ({
  searchQuery,
  clearSearchHref,
}: {
  searchQuery?: string;
  clearSearchHref: string;
}) => {
  if (searchQuery) {
    return (
      <Empty className="gap-4 py-12 md:py-16">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <SearchX aria-hidden className="size-5 text-muted-foreground" />
          </EmptyMedia>
          <EmptyTitle className="text-base">
            No variables match “{searchQuery}”
          </EmptyTitle>
          <EmptyDescription>Try a different key.</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button variant="outline" size="sm" asChild>
            <Link href={clearSearchHref}>Clear search</Link>
          </Button>
        </EmptyContent>
      </Empty>
    );
  }

  return (
    <Empty className="gap-4 py-12 md:py-16">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Braces aria-hidden className="size-5 text-muted-foreground" />
        </EmptyMedia>
        <EmptyTitle className="text-base">No variables yet</EmptyTitle>
        <EmptyDescription>
          Store values like API URLs and secrets once and reference them from
          pipelines.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <VariableModal
          variable={null}
          trigger={
            <Button variant="outline" size="sm">
              <Plus aria-hidden />
              Add variable
            </Button>
          }
        />
      </EmptyContent>
    </Empty>
  );
};

const VariableKey = ({
  variable,
  onEdit,
}: {
  variable: VariableRow;
  onEdit?: EditVariableHandler;
}) => {
  if (!onEdit) {
    return (
      <span className="font-mono text-sm font-medium text-foreground">
        {variable.key}
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onEdit(variable)}
      className="text-left font-mono text-sm font-medium text-foreground underline-offset-4 hover:underline"
    >
      {variable.key}
    </button>
  );
};

const VariableValue = ({ variable }: { variable: VariableRow }) => {
  if (variable.isSecret) {
    return (
      <span className="inline-flex items-center gap-2">
        <span
          aria-hidden
          className="font-mono text-xs tracking-widest text-muted-foreground"
        >
          {variable.value}
        </span>
        <Badge variant="muted" className="gap-1">
          <Lock aria-hidden />
          Secret
        </Badge>
      </span>
    );
  }

  if (variable.value.length === 0) {
    return <span className="text-muted-foreground">—</span>;
  }

  return (
    <CopyableId
      value={variable.value}
      label={`Copy value of ${variable.key}`}
      className="max-w-40 sm:max-w-64"
    />
  );
};

export const VariablesTable = ({
  variables,
  sortBy,
  sortDir,
  pageSize,
  searchQuery,
  onEdit,
}: VariablesTableProps) => {
  const clearSearchHref = buildListHref(BASE_PATH, {
    pageSize,
    sortBy,
    sortDir,
  });

  const sortHeader = (field: VariableSortField, label: string) => {
    const direction = nextSortDirection(field, sortBy, sortDir);
    const href = buildListHref(BASE_PATH, {
      pageSize,
      search: searchQuery,
      sortBy: field,
      sortDir: direction,
    });

    return (
      <SortableHeader
        label={label}
        href={href}
        isActive={sortBy === field}
        direction={sortDir}
      />
    );
  };

  if (variables.length === 0) {
    return (
      <DataTableCard>
        <VariablesEmptyState
          searchQuery={searchQuery}
          clearSearchHref={clearSearchHref}
        />
      </DataTableCard>
    );
  }

  return (
    <DataTableCard>
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="pl-4">{sortHeader("key", "Key")}</TableHead>
            <TableHead>Value</TableHead>
            <TableHead className="hidden md:table-cell">Note</TableHead>
            <TableHead>{sortHeader("created", "Created")}</TableHead>
            <TableHead className="hidden lg:table-cell">Created by</TableHead>
            <TableHead className="w-12 pr-2">
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {variables.map((variable) => {
            const note = variable.note ?? "—";

            return (
              <TableRow key={variable.id}>
                <TableCell className="pl-4">
                  <VariableKey variable={variable} onEdit={onEdit} />
                </TableCell>
                <TableCell>
                  <VariableValue variable={variable} />
                </TableCell>
                <TableCell className="hidden text-muted-foreground md:table-cell">
                  <div
                    className="max-w-xs truncate"
                    title={variable.note ?? undefined}
                  >
                    {note}
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  <RelativeTime value={variable.createdAt} />
                </TableCell>
                <TableCell className="hidden text-muted-foreground lg:table-cell">
                  {formatCreatedBy(variable.createdBy)}
                </TableCell>
                <TableCell className="pr-2 text-right">
                  <VariableRowActions
                    variable={variable}
                    variableLabel={variable.key}
                    onEdit={onEdit}
                  />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </DataTableCard>
  );
};
