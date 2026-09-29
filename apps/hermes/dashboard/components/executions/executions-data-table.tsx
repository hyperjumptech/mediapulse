"use client";

import { useMemo, type ReactNode } from "react";
import Link from "next/link";
import {
  CalendarClock,
  History,
  MousePointerClick,
  Webhook,
  type LucideIcon,
} from "lucide-react";

import { Badge } from "@workspace/ui/components/badge";

import { DataTable } from "@/components/data-table/data-table";
import { DateTime } from "@/components/date-time/date-time";
import { ExecutionInvocationCounts } from "@/components/executions/execution-invocation-counts";
import { ExecutionRowActions } from "@/components/executions/execution-row-actions";
import { StatusBadge, ToneBadge } from "@/components/status-badge";
import type { ColumnVisibility } from "@/lib/data-table/column-visibility";
import { createDataTableColumnHelper } from "@/lib/data-table/features";
import type { ListUrlState } from "@/lib/data-table/list-url-state";
import { isEnqueueDiagnosticsRelevant } from "@/lib/enqueue-diagnostics";
import {
  executionDetailHref,
  executionSourceHref,
  type ExecutionListRow,
  type ExecutionListSource,
} from "@/lib/execution-list";

const SOURCE_PRESENTATION: Record<
  ExecutionListSource,
  { label: string; icon: LucideIcon }
> = {
  schedule: { label: "Schedule", icon: CalendarClock },
  "http-trigger": { label: "Trigger", icon: Webhook },
  manual: { label: "Manual", icon: MousePointerClick },
};

const ExecutionSource = ({ row }: { row: ExecutionListRow }) => {
  const { label, icon: SourceIcon } = SOURCE_PRESENTATION[row.source];
  const sourceHref = executionSourceHref(row);

  return (
    <span className="flex min-w-0 items-center gap-2">
      <Badge variant="outline" className="px-1.5 text-muted-foreground">
        <SourceIcon aria-hidden />
        {label}
      </Badge>
      {sourceHref && row.sourceName ? (
        <Link
          href={sourceHref}
          className="max-w-48 truncate text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          {row.sourceName}
        </Link>
      ) : null}
    </span>
  );
};

const columnHelper = createDataTableColumnHelper<ExecutionListRow>();

const columns = columnHelper.columns([
  columnHelper.accessor("executionTime", {
    id: "started",
    enableHiding: false,
    meta: { label: "Started", mobile: "title" },
    cell: ({ row }) => (
      <Link
        href={executionDetailHref(row.original)}
        className="font-medium text-foreground underline-offset-4 hover:underline"
      >
        <span className="sr-only">Open execution from</span>{" "}
        <DateTime value={row.original.executionTime} variant="both" />
      </Link>
    ),
  }),
  columnHelper.accessor("pipelineName", {
    id: "pipeline",
    meta: { label: "Pipeline", mobile: "subtitle" },
    cell: ({ row }) => (
      <span className="block max-w-56 truncate">
        {row.original.pipelineName ?? "—"}
      </span>
    ),
  }),
  columnHelper.accessor("source", {
    id: "source",
    meta: { label: "Source", mobile: "field" },
    cell: ({ row }) => <ExecutionSource row={row.original} />,
  }),
  columnHelper.accessor("runStatus", {
    id: "run",
    enableHiding: false,
    meta: { label: "Run", mobile: "badge" },
    cell: ({ row }) => (
      <span className="flex items-center gap-1.5">
        <StatusBadge status={row.original.runStatus} />
        {row.original.enqueueStatus &&
        isEnqueueDiagnosticsRelevant(row.original.enqueueStatus) ? (
          <ToneBadge tone="warning">
            {row.original.enqueueStatus === "failed"
              ? "Enqueue failed"
              : "Partly enqueued"}
          </ToneBadge>
        ) : null}
      </span>
    ),
  }),
  columnHelper.display({
    id: "invocations",
    meta: {
      label: "Invocations",
      mobile: "field",
      headerClassName: "text-right",
      cellClassName: "text-right",
    },
    cell: ({ row }) =>
      row.original.succeededInvocationCount === null ||
      row.original.failedInvocationCount === null ? (
        "—"
      ) : (
        <ExecutionInvocationCounts
          succeededInvocationCount={row.original.succeededInvocationCount}
          failedInvocationCount={row.original.failedInvocationCount}
        />
      ),
  }),
  columnHelper.accessor("elapsedLabel", {
    id: "duration",
    meta: {
      label: "Duration",
      mobile: "field",
      headerClassName: "text-right",
      cellClassName: "text-right text-muted-foreground tabular-nums",
    },
    cell: ({ row }) => row.original.elapsedLabel ?? "—",
  }),
  columnHelper.display({
    id: "actions",
    enableHiding: false,
    meta: {
      label: "Actions",
      mobile: "actions",
      cellClassName: "pr-2 text-right",
    },
    cell: ({ row }) => <ExecutionRowActions row={row.original} />,
  }),
]);

export type ExecutionsDataTableColumn = "pipeline" | "source";

type ExecutionsDataTableProps = {
  tableId: string;
  rows: ExecutionListRow[];
  omitColumns?: ExecutionsDataTableColumn[];
  urlState?: ListUrlState;
  paginationLabel?: string;
  emptyTitle?: string;
  emptyDescription: string;
  emptyIcon?: LucideIcon;
  toolbarFilters?: ReactNode;
  title?: string;
  initialColumnVisibility?: ColumnVisibility;
};

export const ExecutionsDataTable = ({
  tableId,
  rows,
  omitColumns = [],
  urlState,
  paginationLabel,
  emptyTitle = "No executions yet",
  emptyDescription,
  emptyIcon = History,
  toolbarFilters,
  title,
  initialColumnVisibility,
}: ExecutionsDataTableProps) => {
  const omitKey = omitColumns.join(",");
  const visibleColumns = useMemo(
    () =>
      columns.filter((column) => !omitKey.split(",").includes(column.id ?? "")),
    [omitKey],
  );

  return (
    <DataTable
      tableId={tableId}
      columns={visibleColumns}
      rows={rows}
      getRowId={(row) => `${row.source}:${row.id}`}
      urlState={urlState}
      paginationLabel={paginationLabel}
      title={title}
      toolbarFilters={toolbarFilters}
      emptyState={{
        icon: emptyIcon,
        title: emptyTitle,
        description: emptyDescription,
      }}
      initialColumnVisibility={initialColumnVisibility}
    />
  );
};
