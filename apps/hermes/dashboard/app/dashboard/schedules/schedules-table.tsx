"use client";

import Link from "next/link";
import { useMemo } from "react";
import { CalendarClock, Plus } from "lucide-react";

import { Button } from "@workspace/ui/components/button";

import { DataTable } from "@/components/data-table/data-table";
import { DateTime } from "@/components/date-time/date-time";
import { StatusBadge } from "@/components/status-badge";
import type { ColumnVisibility } from "@/lib/data-table/column-visibility";
import { createDataTableColumnHelper } from "@/lib/data-table/features";
import type { ListUrlState } from "@/lib/data-table/list-url-state";
import type { SchedulesPageResult } from "@/lib/schedules";

import { describeScheduleCadence } from "./describe-schedule-cadence";
import { ScheduleRowActions } from "./schedule-row-actions";
import {
  SCHEDULES_DEFAULT_COLUMN_VISIBILITY,
  SCHEDULES_TABLE_ID,
} from "./schedules-table-defaults";

export type ScheduleRow = SchedulesPageResult["schedules"][number];

type EditScheduleHandler = (scheduleId: string) => void;

type CreateScheduleHandler = () => void;

const ScheduleCadenceLabel = ({ schedule }: { schedule: ScheduleRow }) => {
  const cadence = describeScheduleCadence(schedule);

  if (cadence.isCronExpression) {
    return (
      <code
        className="font-mono text-xs"
        title={`Cron in ${schedule.timezone}`}
      >
        {cadence.label}
      </code>
    );
  }

  return <span>{cadence.label}</span>;
};

const columnHelper = createDataTableColumnHelper<ScheduleRow>();

const createScheduleColumns = (onEdit: EditScheduleHandler) =>
  columnHelper.columns([
    columnHelper.accessor("name", {
      id: "name",
      enableHiding: false,
      meta: { label: "Name", sortKey: "name", mobile: "title" },
      cell: ({ row }) => (
        <Link
          href={`/dashboard/schedules/${row.original.id}`}
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          {row.original.name}
        </Link>
      ),
    }),
    columnHelper.accessor("pipeline", {
      id: "pipeline",
      meta: {
        label: "Pipeline",
        mobile: "subtitle",
        cellClassName: "text-muted-foreground",
      },
      cell: ({ row }) => (
        <Link
          href={`/dashboard/pipelines/${row.original.pipeline.id}`}
          className="underline-offset-4 hover:text-foreground hover:underline"
        >
          {row.original.pipeline.name}
        </Link>
      ),
    }),
    columnHelper.display({
      id: "repeats",
      meta: {
        label: "Repeats",
        mobile: "field",
        cellClassName: "text-muted-foreground",
      },
      cell: ({ row }) => <ScheduleCadenceLabel schedule={row.original} />,
    }),
    columnHelper.accessor("nextRunAt", {
      id: "nextRun",
      meta: { label: "Next run", sortKey: "nextRunAt", mobile: "field" },
      cell: ({ row }) => (
        <DateTime value={row.original.nextRunAt} variant="both" />
      ),
    }),
    columnHelper.accessor("enabled", {
      id: "status",
      meta: { label: "Status", sortKey: "enabled", mobile: "badge" },
      cell: ({ row }) => (
        <StatusBadge status={row.original.enabled ? "enabled" : "disabled"} />
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
      cell: ({ row }) => (
        <ScheduleRowActions
          scheduleId={row.original.id}
          scheduleName={row.original.name}
          onEdit={onEdit}
        />
      ),
    }),
  ]);

type SchedulesTableProps = {
  schedules: ScheduleRow[];
  urlState: ListUrlState;
  onEdit: EditScheduleHandler;
  onCreate: CreateScheduleHandler;
  initialColumnVisibility?: ColumnVisibility;
};

export const SchedulesTable = ({
  schedules,
  urlState,
  onEdit,
  onCreate,
  initialColumnVisibility = SCHEDULES_DEFAULT_COLUMN_VISIBILITY,
}: SchedulesTableProps) => {
  const columns = useMemo(() => createScheduleColumns(onEdit), [onEdit]);

  return (
    <DataTable
      tableId={SCHEDULES_TABLE_ID}
      columns={columns}
      rows={schedules}
      getRowId={(schedule) => schedule.id}
      urlState={urlState}
      paginationLabel="Schedules list pagination"
      search={{
        label: "Search schedules by name or description",
        placeholder: "Filter schedules…",
      }}
      emptyState={{
        icon: CalendarClock,
        title: "No schedules yet",
        description:
          "Schedules run a pipeline automatically on a cron expression or a fixed interval.",
        action: (
          <Button type="button" variant="outline" size="sm" onClick={onCreate}>
            <Plus aria-hidden />
            New schedule
          </Button>
        ),
      }}
      initialColumnVisibility={initialColumnVisibility}
    />
  );
};
