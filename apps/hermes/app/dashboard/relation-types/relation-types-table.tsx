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
import { RelationTypeModal } from "./relation-type-modal";
import { RelationTypeRowActions } from "./relation-type-row-actions";
import type {
  RelationTypesPageResult,
  RelationTypeSortDir,
  RelationTypeSortField,
} from "@/lib/relation-types";

type RelationTypeRow = RelationTypesPageResult["relationTypes"][number];

const BASE_PATH = "/dashboard/relation-types";

/**
 * Builds relation types list URL with sort (resets to page 1 when sort changes).
 */
const buildSortHref = (
  sortBy: RelationTypeSortField,
  sortDir: RelationTypeSortDir,
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

type RelationTypesTableProps = {
  relationTypes: RelationTypeRow[];
  sortBy: RelationTypeSortField;
  sortDir: RelationTypeSortDir;
  pageSize: number;
  searchQuery?: string;
};

/**
 * Encapsulates relation types table edit modal state.
 */
const useRelationTypesTableState = () => {
  const [editRelationTypeId, setEditRelationTypeId] = useState<string | null>(
    null,
  );
  const [editOpen, setEditOpen] = useState(false);

  const openEdit = useCallback((id: string) => {
    setEditRelationTypeId(id);
    setEditOpen(true);
  }, []);

  return {
    editRelationTypeId,
    setEditRelationTypeId,
    editOpen,
    setEditOpen,
    openEdit,
  };
};

/**
 * Renders relation types list as a sortable table with row actions.
 */
export const RelationTypesTable = ({
  relationTypes,
  sortBy,
  sortDir,
  pageSize,
  searchQuery,
}: RelationTypesTableProps) => {
  const {
    editRelationTypeId,
    setEditRelationTypeId,
    editOpen,
    setEditOpen,
    openEdit,
  } = useRelationTypesTableState();

  const editingRelationType =
    relationTypes.find((row) => row.id === editRelationTypeId) ?? null;

  const sortLink = (field: RelationTypeSortField, label: string) => {
    const isActive = sortBy === field;
    const nextDir: RelationTypeSortDir =
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
            {relationTypes.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="text-center text-muted-foreground"
                >
                  No relation types yet.
                </TableCell>
              </TableRow>
            ) : (
              relationTypes.map((relationType) => (
                <TableRow key={relationType.id}>
                  <TableCell className="font-medium">
                    {relationType.name}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {relationType.description ?? "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {format(relationType.createdAt, "LLL d, yyyy")}
                  </TableCell>
                  <TableCell className="text-right">
                    <RelationTypeRowActions
                      relationTypeId={relationType.id}
                      relationTypeName={relationType.name}
                      onEditClick={openEdit}
                    />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      <RelationTypeModal
        relationType={editingRelationType}
        open={editOpen}
        onOpenChange={(open) => {
          setEditOpen(open);
          if (!open) setEditRelationTypeId(null);
        }}
      />
    </>
  );
};
