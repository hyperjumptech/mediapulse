"use client";

import { Users } from "lucide-react";

import { Badge } from "@workspace/ui/components/badge";

import { DataTable } from "@/components/data-table/data-table";
import { DateTime } from "@/components/date-time/date-time";
import { StatusBadge } from "@/components/status-badge";
import type { ColumnVisibility } from "@/lib/data-table/column-visibility";
import { createDataTableColumnHelper } from "@/lib/data-table/features";
import type { HermesAdminListRow } from "@/lib/hermes-admins-page";

import { AdminRowActions } from "./admin-row-actions";
import {
  ADMINS_DEFAULT_COLUMN_VISIBILITY,
  ADMINS_TABLE_ID,
} from "./admins-table-defaults";

export type AdminRow = HermesAdminListRow & { currentUserId: string };

const columnHelper = createDataTableColumnHelper<AdminRow>();

const columns = columnHelper.columns([
  columnHelper.accessor("name", {
    id: "name",
    enableHiding: false,
    meta: { label: "Name", mobile: "title" },
    cell: ({ row }) => (
      <span className="flex items-center gap-2">
        <span className="truncate font-medium">{row.original.name}</span>
        {row.original.id === row.original.currentUserId ? (
          <Badge variant="outline" className="px-1.5 text-muted-foreground">
            You
          </Badge>
        ) : null}
      </span>
    ),
  }),
  columnHelper.accessor("email", {
    id: "email",
    meta: {
      label: "Email",
      mobile: "subtitle",
      cellClassName: "text-muted-foreground",
    },
    cell: ({ row }) => row.original.email,
  }),
  columnHelper.accessor("isActive", {
    id: "status",
    meta: { label: "Status", mobile: "badge" },
    cell: ({ row }) =>
      row.original.isActive ? (
        <StatusBadge status="active" label="Active" />
      ) : (
        <StatusBadge status="disabled" label="Disabled" />
      ),
  }),
  columnHelper.accessor("createdAt", {
    id: "created",
    meta: {
      label: "Created",
      cellClassName: "text-muted-foreground tabular-nums",
    },
    cell: ({ row }) => <DateTime value={row.original.createdAt} style="date" />,
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
      <AdminRowActions
        admin={row.original}
        currentUserId={row.original.currentUserId}
      />
    ),
  }),
]);

type AdminsTableProps = {
  admins: HermesAdminListRow[];
  currentUserId: string;
  initialColumnVisibility?: ColumnVisibility;
};

export const AdminsTable = ({
  admins,
  currentUserId,
  initialColumnVisibility = ADMINS_DEFAULT_COLUMN_VISIBILITY,
}: AdminsTableProps) => {
  const rows = admins.map((admin) => ({ ...admin, currentUserId }));

  return (
    <DataTable
      tableId={ADMINS_TABLE_ID}
      columns={columns}
      rows={rows}
      getRowId={(admin) => admin.id}
      emptyState={{
        icon: Users,
        title: "No admins yet",
        description: "Use the CLI or “Add admin” to create one.",
      }}
      initialColumnVisibility={initialColumnVisibility}
    />
  );
};
