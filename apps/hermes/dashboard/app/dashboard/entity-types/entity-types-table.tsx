"use client";

import { useCallback, useState } from "react";
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

import { format } from "date-fns";
import { EntityTypeModal } from "./entity-type-modal";
import { EntityTypeRowActions } from "./entity-type-row-actions";
import type {
  EntityTypesPageResult,
  EntityTypeSortDir,
  EntityTypeSortField,
} from "@/lib/entity-types";

type EntityTypeRow = EntityTypesPageResult["entityTypes"][number];

const BASE_PATH = "/dashboard/entity-types";

/**
 * Builds entity types list URL with sort (resets to page 1 when sort changes).
 */
const buildSortHref = (
  sortBy: EntityTypeSortField,
  sortDir: EntityTypeSortDir,
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

type EntityTypesTableProps = {
  entityTypes: EntityTypeRow[];
  sortBy: EntityTypeSortField;
  sortDir: EntityTypeSortDir;
  pageSize: number;
  searchQuery?: string;
};

/**
 * Encapsulates entity types table edit modal state.
 */
const useEntityTypesTableState = () => {
  const [editEntityTypeId, setEditEntityTypeId] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  const openEdit = useCallback((id: string) => {
    setEditEntityTypeId(id);
    setEditOpen(true);
  }, []);

  return {
    editEntityTypeId,
    setEditEntityTypeId,
    editOpen,
    setEditOpen,
    openEdit,
  };
};

/**
 * Renders entity types list as a sortable table with row actions.
 */
export const EntityTypesTable = ({
  entityTypes,
  sortBy,
  sortDir,
  pageSize,
  searchQuery,
}: EntityTypesTableProps) => {
  const {
    editEntityTypeId,
    setEditEntityTypeId,
    editOpen,
    setEditOpen,
    openEdit,
  } = useEntityTypesTableState();

  const editingEntityType =
    entityTypes.find((row) => row.id === editEntityTypeId) ?? null;

  const sortLink = (field: EntityTypeSortField, label: string) => {
    const isActive = sortBy === field;
    const nextDir: EntityTypeSortDir =
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
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow className="border-muted hover:bg-transparent">
              <TableHead>{sortLink("name", "Name")}</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>{sortLink("created", "Created")}</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {entityTypes.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="text-center text-muted-foreground"
                >
                  No entity types yet.
                </TableCell>
              </TableRow>
            ) : (
              entityTypes.map((entityType) => (
                <TableRow key={entityType.id}>
                  <TableCell className="font-medium">
                    {entityType.name}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {entityType.description ?? "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {format(entityType.createdAt, "LLL d, yyyy")}
                  </TableCell>
                  <TableCell className="text-right">
                    <EntityTypeRowActions
                      entityTypeId={entityType.id}
                      entityTypeName={entityType.name}
                      onEditClick={openEdit}
                    />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      <EntityTypeModal
        entityType={editingEntityType}
        open={editOpen}
        onOpenChange={(open) => {
          setEditOpen(open);
          if (!open) setEditEntityTypeId(null);
        }}
      />
    </>
  );
};
