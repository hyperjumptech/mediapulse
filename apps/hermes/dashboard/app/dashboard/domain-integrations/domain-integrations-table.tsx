"use client";

import Link from "next/link";
import { Blocks, Plus } from "lucide-react";

import { Button } from "@workspace/ui/components/button";

import { CopyableId } from "@/components/copyable-id";
import { DataTable } from "@/components/data-table/data-table";
import { StatusBadge } from "@/components/status-badge";
import type { ColumnVisibility } from "@/lib/data-table/column-visibility";
import { createDataTableColumnHelper } from "@/lib/data-table/features";

import { DomainIntegrationRowActions } from "./domain-integration-row-actions";
import {
  DOMAIN_INTEGRATIONS_DEFAULT_COLUMN_VISIBILITY,
  DOMAIN_INTEGRATIONS_TABLE_ID,
} from "./domain-integrations-table-defaults";

export type DomainIntegrationListRow = {
  id: string;
  integrationId: string;
  name: string;
  status: string;
  baseUrl: string | null;
};

const columnHelper = createDataTableColumnHelper<DomainIntegrationListRow>();

const columns = columnHelper.columns([
  columnHelper.accessor("name", {
    id: "name",
    enableHiding: false,
    meta: { label: "Name", mobile: "title" },
    cell: ({ row }) => (
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="truncate font-medium">{row.original.name}</span>
        <CopyableId
          value={row.original.integrationId}
          label={`Copy integration id ${row.original.integrationId}`}
          className="font-normal"
        />
      </div>
    ),
  }),
  columnHelper.accessor("status", {
    id: "status",
    meta: { label: "Status", mobile: "badge" },
    cell: ({ row }) => <StatusBadge status={row.original.status} />,
  }),
  columnHelper.accessor("baseUrl", {
    id: "baseUrl",
    meta: {
      label: "Base URL",
      hideBelow: "lg",
      cellClassName: "text-muted-foreground",
    },
    cell: ({ row }) =>
      row.original.baseUrl ? (
        <div className="max-w-xs truncate" title={row.original.baseUrl}>
          {row.original.baseUrl}
        </div>
      ) : (
        "—"
      ),
  }),
  columnHelper.display({
    id: "actions",
    enableHiding: false,
    meta: {
      label: "Actions",
      mobile: "actions",
      cellClassName: "pr-2 text-right",
    },
    cell: ({ row }) => <DomainIntegrationRowActions row={row.original} />,
  }),
]);

type DomainIntegrationsTableProps = {
  integrations: DomainIntegrationListRow[];
  initialColumnVisibility?: ColumnVisibility;
};

export const DomainIntegrationsTable = ({
  integrations,
  initialColumnVisibility = DOMAIN_INTEGRATIONS_DEFAULT_COLUMN_VISIBILITY,
}: DomainIntegrationsTableProps) => (
  <DataTable
    tableId={DOMAIN_INTEGRATIONS_TABLE_ID}
    columns={columns}
    rows={integrations}
    getRowId={(integration) => integration.id}
    emptyState={{
      icon: Blocks,
      title: "No integrations yet",
      description: "Create one to get an API key.",
      action: (
        <Button variant="outline" size="sm" asChild>
          <Link href="/dashboard/domain-integrations/create">
            <Plus aria-hidden />
            New integration
          </Link>
        </Button>
      ),
    }}
    initialColumnVisibility={initialColumnVisibility}
  />
);
