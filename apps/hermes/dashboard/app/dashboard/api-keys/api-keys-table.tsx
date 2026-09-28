"use client";

import { KeyRound } from "lucide-react";

import { Badge } from "@workspace/ui/components/badge";

import { DataTable } from "@/components/data-table/data-table";
import { DateTime } from "@/components/date-time/date-time";
import type { ColumnVisibility } from "@/lib/data-table/column-visibility";
import { createDataTableColumnHelper } from "@/lib/data-table/features";
import { formatCreatedBy } from "@/lib/format-created-by";
import type { McpApiKeyListRow } from "@/lib/mcp-api-keys";

import { ApiKeyRowActions } from "./api-key-row-actions";
import {
  API_KEYS_DEFAULT_COLUMN_VISIBILITY,
  API_KEYS_TABLE_ID,
} from "./api-keys-table-defaults";

const ApiKeyAccessBadge = ({ readOnly }: { readOnly: boolean }) => (
  <Badge variant="outline" className="px-1.5 text-muted-foreground">
    {readOnly ? "Read-only" : "Full"}
  </Badge>
);

const columnHelper = createDataTableColumnHelper<McpApiKeyListRow>();

const columns = columnHelper.columns([
  columnHelper.accessor("label", {
    id: "label",
    enableHiding: false,
    meta: { label: "Label", mobile: "title", cellClassName: "font-medium" },
    cell: ({ row }) => row.original.label,
  }),
  columnHelper.accessor("readOnly", {
    id: "access",
    meta: { label: "Access", mobile: "badge" },
    cell: ({ row }) => <ApiKeyAccessBadge readOnly={row.original.readOnly} />,
  }),
  columnHelper.accessor("createdAt", {
    id: "created",
    meta: {
      label: "Created",
      cellClassName: "text-muted-foreground tabular-nums",
    },
    cell: ({ row }) => <DateTime value={row.original.createdAt} style="date" />,
  }),
  columnHelper.accessor("lastUsedAt", {
    id: "lastUsed",
    meta: { label: "Last used", cellClassName: "text-muted-foreground" },
    cell: ({ row }) =>
      row.original.lastUsedAt ? (
        <DateTime value={row.original.lastUsedAt} variant="both" />
      ) : (
        "Never"
      ),
  }),
  columnHelper.accessor("createdBy", {
    id: "createdBy",
    meta: {
      label: "Created by",
      hideBelow: "lg",
      cellClassName: "text-muted-foreground",
    },
    cell: ({ row }) =>
      formatCreatedBy(row.original.createdBy, row.original.createdByUserId),
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
      <ApiKeyRowActions
        row={{ id: row.original.id, label: row.original.label }}
      />
    ),
  }),
]);

type ApiKeysTableProps = {
  apiKeys: McpApiKeyListRow[];
  initialColumnVisibility?: ColumnVisibility;
};

export const ApiKeysTable = ({
  apiKeys,
  initialColumnVisibility = API_KEYS_DEFAULT_COLUMN_VISIBILITY,
}: ApiKeysTableProps) => (
  <DataTable
    tableId={API_KEYS_TABLE_ID}
    columns={columns}
    rows={apiKeys}
    getRowId={(apiKey) => apiKey.id}
    emptyState={{
      icon: KeyRound,
      title: "No API keys yet",
      description: "Create one for MCP access.",
    }}
    initialColumnVisibility={initialColumnVisibility}
  />
);
