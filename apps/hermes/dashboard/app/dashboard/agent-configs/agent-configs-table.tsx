"use client";

import Link from "next/link";
import { Plus, SlidersHorizontal } from "lucide-react";

import { Button } from "@workspace/ui/components/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@workspace/ui/components/tooltip";

import { DataTable } from "@/components/data-table/data-table";
import { DateTime } from "@/components/date-time/date-time";
import { StatusBadge } from "@/components/status-badge";
import type { ColumnVisibility } from "@/lib/data-table/column-visibility";
import { createDataTableColumnHelper } from "@/lib/data-table/features";
import type { ListUrlState } from "@/lib/data-table/list-url-state";
import { formatCreatedBy } from "@/lib/format-created-by";

import {
  AgentConfigRowActions,
  type AgentConfigRow,
} from "./agent-config-row-actions";
import {
  AGENT_CONFIGS_DEFAULT_COLUMN_VISIBILITY,
  AGENT_CONFIGS_TABLE_ID,
} from "./agent-configs-table-defaults";

const BASE_PATH = "/dashboard/agent-configs";

const SchemaStatus = ({ schemaValid }: { schemaValid: boolean }) => {
  if (schemaValid) {
    return <span className="text-sm text-muted-foreground">Up to date</span>;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          tabIndex={0}
          className="inline-flex rounded-full outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <StatusBadge status="invalid" label="Schema changed" />
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-64">
        The agent&apos;s config schema changed after this preset was saved. Edit
        the preset to review its fields.
      </TooltipContent>
    </Tooltip>
  );
};

const columnHelper = createDataTableColumnHelper<AgentConfigRow>();

const columns = columnHelper.columns([
  columnHelper.accessor("name", {
    id: "name",
    enableHiding: false,
    meta: { label: "Name", sortKey: "name", mobile: "title" },
    cell: ({ row }) => (
      <Link
        href={`${BASE_PATH}/${row.original.id}/edit`}
        className="font-medium text-foreground underline-offset-4 hover:underline"
      >
        {row.original.name}
      </Link>
    ),
  }),
  columnHelper.accessor("agentId", {
    id: "agent",
    meta: {
      label: "Agent",
      sortKey: "agentId",
      mobile: "subtitle",
      cellClassName: "font-mono text-xs text-muted-foreground",
    },
    cell: ({ row }) => `${row.original.agentId}@${row.original.agentVersion}`,
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
  columnHelper.accessor("schemaValid", {
    id: "status",
    meta: { label: "Status", mobile: "badge" },
    cell: ({ row }) => <SchemaStatus schemaValid={row.original.schemaValid} />,
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
      <AgentConfigRowActions
        config={row.original}
        configLabel={row.original.name}
      />
    ),
  }),
]);

type AgentConfigsTableProps = {
  configs: AgentConfigRow[];
  urlState: ListUrlState;
  initialColumnVisibility?: ColumnVisibility;
};

export const AgentConfigsTable = ({
  configs,
  urlState,
  initialColumnVisibility = AGENT_CONFIGS_DEFAULT_COLUMN_VISIBILITY,
}: AgentConfigsTableProps) => (
  <DataTable
    tableId={AGENT_CONFIGS_TABLE_ID}
    columns={columns}
    rows={configs}
    getRowId={(config) => config.id}
    urlState={urlState}
    paginationLabel="Agent configs list pagination"
    emptyState={{
      icon: SlidersHorizontal,
      title: "No agent configs yet",
      description: "Save reusable settings for an agent as a preset.",
      action: (
        <Button variant="outline" size="sm" asChild>
          <Link href={`${BASE_PATH}/new`}>
            <Plus aria-hidden />
            Add config
          </Link>
        </Button>
      ),
    }}
    initialColumnVisibility={initialColumnVisibility}
  />
);
