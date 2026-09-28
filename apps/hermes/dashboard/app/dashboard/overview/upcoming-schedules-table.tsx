"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { CalendarOff } from "lucide-react";

import { DataTable } from "@/components/data-table/data-table";
import { DateTime } from "@/components/date-time/date-time";
import { StatusBadge, ToneBadge } from "@/components/status-badge";
import type { ColumnVisibility } from "@/lib/data-table/column-visibility";
import { createDataTableColumnHelper } from "@/lib/data-table/features";
import type { UpcomingSchedule } from "@/lib/dashboard-overview";

const columnHelper = createDataTableColumnHelper<UpcomingSchedule>();

const columns = columnHelper.columns([
  columnHelper.accessor("name", {
    id: "name",
    enableHiding: false,
    meta: { label: "Name", mobile: "title" },
    cell: ({ row }) => (
      <Link
        href={`/dashboard/schedules/${row.original.id}`}
        className="block max-w-64 truncate font-medium text-foreground underline-offset-4 hover:underline"
      >
        {row.original.name}
      </Link>
    ),
  }),
  columnHelper.accessor((schedule) => schedule.pipeline.name, {
    id: "pipeline",
    meta: { label: "Pipeline", mobile: "subtitle" },
    cell: ({ row }) => (
      <span className="block max-w-56 truncate">
        {row.original.pipeline.name}
      </span>
    ),
  }),
  columnHelper.accessor("nextRunAt", {
    id: "nextRun",
    enableHiding: false,
    meta: { label: "Next run", mobile: "field" },
    cell: ({ row }) => (
      <DateTime value={row.original.nextRunAt} variant="both" />
    ),
  }),
  columnHelper.accessor((schedule) => schedule.pipeline.isActive, {
    id: "status",
    meta: { label: "Status", mobile: "badge" },
    cell: ({ row }) =>
      row.original.pipeline.isActive ? (
        <StatusBadge status="enabled" />
      ) : (
        <ToneBadge tone="muted">Pipeline disabled</ToneBadge>
      ),
  }),
]);

type UpcomingSchedulesTableProps = {
  tableId: string;
  schedules: UpcomingSchedule[];
  toolbarFilters?: ReactNode;
  initialColumnVisibility?: ColumnVisibility;
};

export const UpcomingSchedulesTable = ({
  tableId,
  schedules,
  toolbarFilters,
  initialColumnVisibility,
}: UpcomingSchedulesTableProps) => (
  <DataTable
    tableId={tableId}
    columns={columns}
    rows={schedules}
    getRowId={(schedule) => schedule.id}
    toolbarFilters={toolbarFilters}
    emptyState={{
      icon: CalendarOff,
      title: "No upcoming runs",
      description: "Enabled schedules with a next run time show up here.",
    }}
    initialColumnVisibility={initialColumnVisibility}
  />
);
