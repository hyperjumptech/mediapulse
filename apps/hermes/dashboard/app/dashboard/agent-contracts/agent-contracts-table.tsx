"use client";

import { useMemo } from "react";
import { FileText, Plus } from "lucide-react";

import { Button } from "@workspace/ui/components/button";

import { DataTable } from "@/components/data-table/data-table";
import { DateTime } from "@/components/date-time/date-time";
import type { ColumnVisibility } from "@/lib/data-table/column-visibility";
import { createDataTableColumnHelper } from "@/lib/data-table/features";
import type { ListUrlState } from "@/lib/data-table/list-url-state";
import { formatCreatedBy } from "@/lib/format-created-by";

import { AddContractModal } from "./add-contract-modal";
import {
  AgentContractRowActions,
  type AgentContractRow,
} from "./agent-contract-row-actions";
import {
  AGENT_CONTRACTS_DEFAULT_COLUMN_VISIBILITY,
  AGENT_CONTRACTS_TABLE_ID,
} from "./agent-contracts-table-defaults";

type EditContractHandler = (contract: AgentContractRow) => void;

const columnHelper = createDataTableColumnHelper<AgentContractRow>();

const buildColumns = (onEdit: EditContractHandler) =>
  columnHelper.columns([
    columnHelper.accessor("name", {
      id: "name",
      enableHiding: false,
      meta: { label: "Name", sortKey: "name", mobile: "title" },
      cell: ({ row }) => (
        <button
          type="button"
          onClick={() => onEdit(row.original)}
          className="text-left font-medium text-foreground underline-offset-4 hover:underline"
          aria-label={`Edit contract ${row.original.name}`}
        >
          {row.original.name}
        </button>
      ),
    }),
    columnHelper.accessor("version", {
      id: "version",
      meta: {
        label: "Version",
        mobile: "subtitle",
        cellClassName: "font-mono text-xs text-muted-foreground tabular-nums",
      },
      cell: ({ row }) => row.original.version,
    }),
    columnHelper.accessor("description", {
      id: "description",
      meta: {
        label: "Description",
        hideBelow: "md",
        mobile: "hidden",
        cellClassName: "text-muted-foreground",
      },
      cell: ({ row }) => (
        <div
          className="max-w-xs truncate"
          title={row.original.description ?? undefined}
        >
          {row.original.description ?? "—"}
        </div>
      ),
    }),
    columnHelper.accessor("createdAt", {
      id: "created",
      meta: {
        label: "Created",
        sortKey: "createdAt",
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
        <AgentContractRowActions contract={row.original} onEdit={onEdit} />
      ),
    }),
  ]);

type AgentContractsTableProps = {
  contracts: AgentContractRow[];
  urlState: ListUrlState;
  onEdit: EditContractHandler;
  initialColumnVisibility?: ColumnVisibility;
};

export const AgentContractsTable = ({
  contracts,
  urlState,
  onEdit,
  initialColumnVisibility = AGENT_CONTRACTS_DEFAULT_COLUMN_VISIBILITY,
}: AgentContractsTableProps) => {
  const columns = useMemo(() => buildColumns(onEdit), [onEdit]);

  return (
    <DataTable
      tableId={AGENT_CONTRACTS_TABLE_ID}
      columns={columns}
      rows={contracts}
      getRowId={(contract) => contract.id}
      urlState={urlState}
      paginationLabel="Agent contracts list pagination"
      emptyState={{
        icon: FileText,
        title: "No agent contracts yet",
        description: "Write a product brief once and reuse it across agents.",
        action: (
          <AddContractModal
            trigger={
              <Button variant="outline" size="sm">
                <Plus aria-hidden />
                Add contract
              </Button>
            }
          />
        ),
      }}
      initialColumnVisibility={initialColumnVisibility}
    />
  );
};
