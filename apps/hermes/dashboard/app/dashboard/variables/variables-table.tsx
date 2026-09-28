"use client";

import { useMemo } from "react";
import { Braces, Lock, Plus } from "lucide-react";

import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";

import { CopyableId } from "@/components/copyable-id";
import { DataTable } from "@/components/data-table/data-table";
import { DateTime } from "@/components/date-time/date-time";
import type { ColumnVisibility } from "@/lib/data-table/column-visibility";
import { createDataTableColumnHelper } from "@/lib/data-table/features";
import type { ListUrlState } from "@/lib/data-table/list-url-state";
import { formatCreatedBy } from "@/lib/format-created-by";
import type { VariableRow } from "@/lib/variables";

import { useVariableEditor } from "./use-variable-editor";
import { VariableModal } from "./variable-modal";
import { VariableRowActions } from "./variable-row-actions";
import {
  VARIABLES_DEFAULT_COLUMN_VISIBILITY,
  VARIABLES_TABLE_ID,
} from "./variables-table-defaults";

type EditVariableHandler = (variable: VariableRow) => void;

const VariableKey = ({
  variable,
  onEdit,
}: {
  variable: VariableRow;
  onEdit: EditVariableHandler;
}) => (
  <button
    type="button"
    onClick={() => onEdit(variable)}
    className="text-left font-mono text-sm font-medium text-foreground underline-offset-4 hover:underline"
  >
    {variable.key}
  </button>
);

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

const columnHelper = createDataTableColumnHelper<VariableRow>();

const createVariableColumns = (onEdit: EditVariableHandler) =>
  columnHelper.columns([
    columnHelper.accessor("key", {
      id: "key",
      enableHiding: false,
      meta: { label: "Key", sortKey: "key", mobile: "title" },
      cell: ({ row }) => (
        <VariableKey variable={row.original} onEdit={onEdit} />
      ),
    }),
    columnHelper.accessor("value", {
      id: "value",
      meta: { label: "Value", mobile: "subtitle" },
      cell: ({ row }) => <VariableValue variable={row.original} />,
    }),
    columnHelper.accessor("note", {
      id: "note",
      meta: {
        label: "Note",
        hideBelow: "md",
        mobile: "hidden",
        cellClassName: "text-muted-foreground",
      },
      cell: ({ row }) => (
        <div
          className="max-w-xs truncate"
          title={row.original.note ?? undefined}
        >
          {row.original.note ?? "—"}
        </div>
      ),
    }),
    columnHelper.accessor("createdAt", {
      id: "created",
      meta: {
        label: "Created",
        sortKey: "created",
        cellClassName: "text-muted-foreground",
      },
      cell: ({ row }) => <DateTime value={row.original.createdAt} />,
    }),
    columnHelper.accessor("createdBy", {
      id: "createdBy",
      meta: { label: "Created by", cellClassName: "text-muted-foreground" },
      cell: ({ row }) => formatCreatedBy(row.original.createdBy),
    }),
    columnHelper.display({
      id: "actions",
      enableHiding: false,
      meta: {
        label: "Actions",
        mobile: "actions",
        cellClassName: "pr-2 text-right",
      },
      cell: ({ row }) => (
        <VariableRowActions
          variable={row.original}
          variableLabel={row.original.key}
          onEdit={onEdit}
        />
      ),
    }),
  ]);

type VariablesTableProps = {
  variables: VariableRow[];
  urlState: ListUrlState;
  initialColumnVisibility?: ColumnVisibility;
};

export const VariablesTable = ({
  variables,
  urlState,
  initialColumnVisibility = VARIABLES_DEFAULT_COLUMN_VISIBILITY,
}: VariablesTableProps) => {
  const { editingVariable, openEditor, handleEditorOpenChange } =
    useVariableEditor();
  const columns = useMemo(
    () => createVariableColumns(openEditor),
    [openEditor],
  );

  return (
    <>
      <DataTable
        tableId={VARIABLES_TABLE_ID}
        columns={columns}
        rows={variables}
        getRowId={(variable) => variable.id}
        urlState={urlState}
        paginationLabel="Variables list pagination"
        search={{
          label: "Search variables by key",
          placeholder: "Search by key…",
        }}
        emptyState={{
          icon: Braces,
          title: "No variables yet",
          description:
            "Store values like API URLs and secrets once and reference them from pipelines.",
          action: (
            <VariableModal
              variable={null}
              trigger={
                <Button variant="outline" size="sm">
                  <Plus aria-hidden />
                  Add variable
                </Button>
              }
            />
          ),
        }}
        initialColumnVisibility={initialColumnVisibility}
      />
      <VariableModal
        variable={editingVariable}
        open={editingVariable !== null}
        onOpenChange={handleEditorOpenChange}
      />
    </>
  );
};
