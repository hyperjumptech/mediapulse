"use client";

import Link from "next/link";
import { Bot } from "lucide-react";

import { DataTable } from "@/components/data-table/data-table";
import { DateTime } from "@/components/date-time/date-time";
import { StatusBadge } from "@/components/status-badge";
import type { AgentsPageResult } from "@/lib/agents";
import type { ColumnVisibility } from "@/lib/data-table/column-visibility";
import { createDataTableColumnHelper } from "@/lib/data-table/features";
import type { ListUrlState } from "@/lib/data-table/list-url-state";

import { AgentRowActions } from "./agent-row-actions";
import {
  AGENTS_DEFAULT_COLUMN_VISIBILITY,
  AGENTS_TABLE_ID,
} from "./agents-table-defaults";

export type AgentRow = AgentsPageResult["agents"][number];

const columnHelper = createDataTableColumnHelper<AgentRow>();

const columns = columnHelper.columns([
  columnHelper.accessor("agentId", {
    id: "agentId",
    enableHiding: false,
    meta: { label: "Agent ID", sortKey: "agentId", mobile: "title" },
    cell: ({ row }) => (
      <Link
        href={`/dashboard/agents/${row.original.id}`}
        className="font-medium text-foreground underline-offset-4 hover:underline"
      >
        {row.original.agentId}
      </Link>
    ),
  }),
  columnHelper.accessor("agentVersion", {
    id: "agentVersion",
    meta: {
      label: "Version",
      sortKey: "agentVersion",
      mobile: "subtitle",
      cellClassName: "font-mono text-xs text-muted-foreground tabular-nums",
    },
    cell: ({ row }) => row.original.agentVersion,
  }),
  columnHelper.accessor("description", {
    id: "description",
    meta: {
      label: "Description",
      hideBelow: "lg",
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
  columnHelper.accessor("isActive", {
    id: "status",
    meta: { label: "Status", mobile: "badge" },
    cell: ({ row }) => (
      <StatusBadge status={row.original.isActive ? "active" : "inactive"} />
    ),
  }),
  columnHelper.accessor("updatedAt", {
    id: "updated",
    meta: {
      label: "Updated",
      sortKey: "updated",
      cellClassName: "text-muted-foreground",
    },
    cell: ({ row }) => <DateTime value={row.original.updatedAt} />,
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
  columnHelper.display({
    id: "actions",
    enableHiding: false,
    meta: {
      label: "Actions",
      mobile: "actions",
      cellClassName: "pr-2 text-right",
    },
    cell: ({ row }) => (
      <AgentRowActions
        agent={row.original}
        agentLabel={`${row.original.agentId}@${row.original.agentVersion}`}
      />
    ),
  }),
]);

type AgentsTableProps = {
  agents: AgentRow[];
  urlState: ListUrlState;
  initialColumnVisibility?: ColumnVisibility;
};

export const AgentsTable = ({
  agents,
  urlState,
  initialColumnVisibility = AGENTS_DEFAULT_COLUMN_VISIBILITY,
}: AgentsTableProps) => (
  <DataTable
    tableId={AGENTS_TABLE_ID}
    columns={columns}
    rows={agents}
    getRowId={(agent) => agent.id}
    urlState={urlState}
    paginationLabel="Agents list pagination"
    search={{
      label: "Search agents by ID or description",
      placeholder: "Filter agents…",
    }}
    emptyState={{
      icon: Bot,
      title: "No agents registered",
      description: "Agents appear here after they register with Hermes.",
    }}
    initialColumnVisibility={initialColumnVisibility}
  />
);
