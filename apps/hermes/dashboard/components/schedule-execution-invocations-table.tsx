"use client";

import { useMemo } from "react";
import { Workflow } from "lucide-react";

import { DropdownMenuItem } from "@workspace/ui/components/dropdown-menu";
import { cn } from "@workspace/ui/lib/utils";

import { CopyableId } from "@/components/copyable-id";
import { DataTable } from "@/components/data-table/data-table";
import { RowActionsMenu } from "@/components/data-table/row-actions-menu";
import { DateTime } from "@/components/date-time/date-time";
import { InvocationActivityDialog } from "@/components/execution-detail/invocation-activity-dialog";
import { InvocationDetailDialog } from "@/components/execution-detail/invocation-detail-dialog";
import { StatusBadge } from "@/components/status-badge";
import {
  computeJobElapsedDisplay,
  formatJobElapsedCell,
} from "@/lib/compute-execution-elapsed";
import type { ColumnVisibility } from "@/lib/data-table/column-visibility";
import { createDataTableColumnHelper } from "@/lib/data-table/features";
import { formatQueueAttemptsDisplay } from "@/lib/format-queue-attempts-display";
import { resolveInvocationOutcomeLabel } from "@/lib/invocation-display-status";

import { useAgentActivityModal } from "./use-agent-activity-modal";
import {
  useScheduleExecutionInvocationsModal,
  type InvocationPayloadSource,
  type ScheduleExecutionInvocationRow,
} from "./use-schedule-execution-invocations-modal";
import {
  INVOCATIONS_DEFAULT_COLUMN_VISIBILITY,
  INVOCATIONS_TABLE_ID,
} from "./schedule-execution-invocations-table-defaults";

type InvocationHandler = (invocation: ScheduleExecutionInvocationRow) => void;

type InvocationActions = {
  openDetail: InvocationHandler;
  openActivity: InvocationHandler;
};

export type ScheduleExecutionInvocationsTableProps = {
  invocations: ScheduleExecutionInvocationRow[];
  title?: string;
  payloadSource: InvocationPayloadSource;
  initialColumnVisibility?: ColumnVisibility;
};

const invocationOutcome = (invocation: ScheduleExecutionInvocationRow) =>
  resolveInvocationOutcomeLabel(invocation.status, invocation.semanticStatus);

const parseOptionalIso = (iso: string | null): Date | null =>
  iso == null ? null : new Date(iso);

const outcomeSummaryClassName = (
  outcome: string,
  outcomeSummary: string | null,
): string => {
  if (outcome === "failure") {
    return "text-destructive dark:text-red-400";
  }
  if (outcomeSummary?.includes("Partial")) {
    return "text-amber-700 dark:text-amber-400";
  }

  return "text-muted-foreground";
};

const InvocationAttempts = ({
  invocation,
}: {
  invocation: ScheduleExecutionInvocationRow;
}) => {
  const attemptsLabel = formatQueueAttemptsDisplay(
    invocation.dataQueueAttempts,
    invocation.dataQueueMaxAttempts,
  );

  return (
    <span title="DataQueue processing attempts (current / max)">
      {attemptsLabel}
    </span>
  );
};

const InvocationDuration = ({
  invocation,
}: {
  invocation: ScheduleExecutionInvocationRow;
}) => {
  const startedAt = parseOptionalIso(invocation.startedAtIso);
  const completedAt = parseOptionalIso(invocation.completedAtIso);
  const elapsed = computeJobElapsedDisplay(startedAt, completedAt);
  const durationLabel = formatJobElapsedCell(elapsed);

  return <span suppressHydrationWarning>{durationLabel}</span>;
};

const InvocationOutcomeSummary = ({
  invocation,
}: {
  invocation: ScheduleExecutionInvocationRow;
}) => {
  const summaryClassName = outcomeSummaryClassName(
    invocationOutcome(invocation),
    invocation.outcomeSummary,
  );

  return (
    <span
      className={cn("block max-w-xs truncate", summaryClassName)}
      title={invocation.outcomeSummary ?? undefined}
    >
      {invocation.outcomeSummary ?? "—"}
    </span>
  );
};

const columnHelper =
  createDataTableColumnHelper<ScheduleExecutionInvocationRow>();

const createInvocationColumns = ({
  openDetail,
  openActivity,
}: InvocationActions) =>
  columnHelper.columns([
    columnHelper.accessor("agentId", {
      id: "agent",
      enableHiding: false,
      sortFn: "text",
      meta: { label: "Agent", sortKey: "agent", mobile: "title" },
      cell: ({ row }) => (
        <button
          type="button"
          onClick={() => openDetail(row.original)}
          className="block max-w-56 truncate rounded text-left font-mono text-xs font-medium text-foreground underline-offset-4 outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <span className="sr-only">Open invocation details for</span>{" "}
          {row.original.agentId}
        </button>
      ),
    }),
    columnHelper.accessor(invocationOutcome, {
      id: "status",
      sortFn: "text",
      meta: { label: "Status", sortKey: "status", mobile: "badge" },
      cell: ({ getValue }) => <StatusBadge status={getValue()} />,
    }),
    columnHelper.display({
      id: "attempts",
      meta: {
        label: "Attempts",
        hideBelow: "lg",
        cellClassName: "text-muted-foreground tabular-nums",
      },
      cell: ({ row }) => <InvocationAttempts invocation={row.original} />,
    }),
    columnHelper.accessor(
      (invocation) => parseOptionalIso(invocation.startedAtIso) ?? undefined,
      {
        id: "started",
        sortFn: "datetime",
        sortUndefined: "last",
        meta: {
          label: "Started",
          sortKey: "started",
          cellClassName: "text-muted-foreground",
        },
        cell: ({ row }) => <DateTime value={row.original.startedAtIso} />,
      },
    ),
    columnHelper.display({
      id: "duration",
      meta: {
        label: "Duration",
        cellClassName: "text-muted-foreground tabular-nums",
      },
      cell: ({ row }) => <InvocationDuration invocation={row.original} />,
    }),
    columnHelper.accessor("outcomeSummary", {
      id: "outcome",
      meta: { label: "Outcome" },
      cell: ({ row }) => <InvocationOutcomeSummary invocation={row.original} />,
    }),
    columnHelper.accessor("jobId", {
      id: "jobId",
      meta: { label: "Job UUID" },
      cell: ({ row }) => (
        <CopyableId
          value={row.original.jobId}
          label={`Copy job UUID ${row.original.jobId}`}
          className="max-w-48"
        />
      ),
    }),
    columnHelper.display({
      id: "actions",
      enableHiding: false,
      meta: { label: "Actions", mobile: "actions" },
      cell: ({ row }) => (
        <RowActionsMenu label="Invocation actions">
          <DropdownMenuItem onSelect={() => openDetail(row.original)}>
            View details
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => openActivity(row.original)}>
            View activity
          </DropdownMenuItem>
        </RowActionsMenu>
      ),
    }),
  ]);

export const ScheduleExecutionInvocationsTable = ({
  invocations,
  title,
  payloadSource,
  initialColumnVisibility = INVOCATIONS_DEFAULT_COLUMN_VISIBILITY,
}: ScheduleExecutionInvocationsTableProps) => {
  const invocationDetail = useScheduleExecutionInvocationsModal(payloadSource);
  const activity = useAgentActivityModal();
  const openDetailModal = invocationDetail.openModal;
  const openActivityModal = activity.openModal;
  const columns = useMemo(
    () =>
      createInvocationColumns({
        openDetail: (invocation) => {
          void openDetailModal(invocation);
        },
        openActivity: (invocation) => {
          void openActivityModal(
            invocation.jobId,
            invocationOutcome(invocation),
          );
        },
      }),
    [openDetailModal, openActivityModal],
  );

  return (
    <>
      <DataTable
        tableId={INVOCATIONS_TABLE_ID}
        title={title}
        count={title ? invocations.length : undefined}
        columns={columns}
        rows={invocations}
        getRowId={(invocation) => invocation.jobId}
        clientSorting={{ initial: { id: "started", desc: false } }}
        emptyState={{
          icon: Workflow,
          title: "No invocations",
          description:
            "Agent jobs show up here once this execution enqueues them.",
        }}
        initialColumnVisibility={initialColumnVisibility}
      />
      <InvocationDetailDialog
        open={invocationDetail.open}
        selected={invocationDetail.selected}
        payload={invocationDetail.payload}
        loading={invocationDetail.loading}
        errorMessage={invocationDetail.errorMessage}
        onOpenChange={invocationDetail.onOpenChange}
      />
      <InvocationActivityDialog
        open={activity.open}
        jobId={activity.jobId}
        outcome={activity.outcome}
        rows={activity.rows}
        loading={activity.loading}
        onOpenChange={activity.onOpenChange}
      />
    </>
  );
};
