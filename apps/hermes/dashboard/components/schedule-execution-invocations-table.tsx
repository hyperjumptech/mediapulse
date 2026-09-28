"use client";

import type { MouseEvent } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, Workflow } from "lucide-react";

import { Button } from "@workspace/ui/components/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@workspace/ui/components/empty";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table";

import { DataTableCard } from "@/components/data-table/data-table-card";
import { InvocationActivityDialog } from "@/components/execution-detail/invocation-activity-dialog";
import { InvocationDetailDialog } from "@/components/execution-detail/invocation-detail-dialog";
import { RelativeTime } from "@/components/relative-time";
import { StatusBadge } from "@/components/status-badge";
import {
  computeJobElapsedDisplay,
  formatJobElapsedCell,
} from "@/lib/compute-execution-elapsed";
import { formatQueueAttemptsDisplay } from "@/lib/format-queue-attempts-display";
import { resolveInvocationOutcomeLabel } from "@/lib/invocation-display-status";

import { useAgentActivityModal } from "./use-agent-activity-modal";
import {
  useScheduleExecutionInvocationsModal,
  type InvocationPayloadSource,
  type ScheduleExecutionInvocationRow,
} from "./use-schedule-execution-invocations-modal";
import {
  useScheduleExecutionInvocationsSort,
  type ScheduleExecutionInvocationSortDir,
  type ScheduleExecutionInvocationSortField,
} from "./use-schedule-execution-invocations-sort";

type ToggleInvocationSortHandler = (
  field: ScheduleExecutionInvocationSortField,
) => void;

type OpenInvocationDetailHandler = (
  invocation: ScheduleExecutionInvocationRow,
) => void;

type OpenInvocationActivityHandler = (jobId: string, outcome: string) => void;

type ButtonClickEvent = MouseEvent<HTMLButtonElement>;

export type ScheduleExecutionInvocationsTableProps = {
  invocations: ScheduleExecutionInvocationRow[];
  payloadSource: InvocationPayloadSource;
};

const ariaSortFor = (
  isActive: boolean,
  sortDirection: ScheduleExecutionInvocationSortDir,
) => {
  if (!isActive) {
    return undefined;
  }

  return sortDirection === "asc" ? "ascending" : "descending";
};

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

const parseOptionalIso = (iso: string | null): Date | null =>
  iso == null ? null : new Date(iso);

const InvocationSortButton = ({
  field,
  label,
  isActive,
  sortDirection,
  onToggle,
}: {
  field: ScheduleExecutionInvocationSortField;
  label: string;
  isActive: boolean;
  sortDirection: ScheduleExecutionInvocationSortDir;
  onToggle: ToggleInvocationSortHandler;
}) => {
  const activeIcon = sortDirection === "asc" ? ArrowUp : ArrowDown;
  const Icon = isActive ? activeIcon : ArrowUpDown;
  const iconClassName = isActive ? "size-3.5" : "size-3.5 opacity-40";

  return (
    <button
      type="button"
      onClick={() => onToggle(field)}
      className="-ml-1 inline-flex items-center gap-1 rounded px-1 py-0.5 outline-none hover:bg-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      {label}
      <Icon aria-hidden className={iconClassName} />
    </button>
  );
};

const OptionalRelativeTime = ({ iso }: { iso: string | null }) => {
  if (iso == null) {
    return <span className="text-muted-foreground">—</span>;
  }

  return <RelativeTime value={iso} />;
};

const InvocationRow = ({
  invocation,
  onOpenDetail,
  onOpenActivity,
}: {
  invocation: ScheduleExecutionInvocationRow;
  onOpenDetail: OpenInvocationDetailHandler;
  onOpenActivity: OpenInvocationActivityHandler;
}) => {
  const outcome = resolveInvocationOutcomeLabel(
    invocation.status,
    invocation.semanticStatus,
  );
  const startedAt = parseOptionalIso(invocation.startedAtIso);
  const completedAt = parseOptionalIso(invocation.completedAtIso);
  const elapsed = computeJobElapsedDisplay(startedAt, completedAt);
  const durationLabel = formatJobElapsedCell(elapsed);
  const attemptsLabel = formatQueueAttemptsDisplay(
    invocation.dataQueueAttempts,
    invocation.dataQueueMaxAttempts,
  );
  const summaryClassName = outcomeSummaryClassName(
    outcome,
    invocation.outcomeSummary,
  );
  const summaryText = invocation.outcomeSummary ?? "—";
  const summaryTitle = invocation.outcomeSummary ?? undefined;

  const openDetail = () => {
    onOpenDetail(invocation);
  };

  const openDetailFromButton = (event: ButtonClickEvent) => {
    event.stopPropagation();
    onOpenDetail(invocation);
  };

  const openActivity = (event: ButtonClickEvent) => {
    event.stopPropagation();
    onOpenActivity(invocation.jobId, outcome);
  };

  return (
    <TableRow className="cursor-pointer" onClick={openDetail}>
      <TableCell className="pl-4">
        <button
          type="button"
          onClick={openDetailFromButton}
          title={invocation.jobId}
          className="block max-w-40 truncate rounded font-mono text-xs text-foreground underline-offset-4 outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          {invocation.jobId}
        </button>
      </TableCell>
      <TableCell>
        <code className="font-mono text-xs">{invocation.agentId}</code>
      </TableCell>
      <TableCell>
        <StatusBadge status={outcome} />
      </TableCell>
      <TableCell
        className="hidden text-muted-foreground tabular-nums lg:table-cell"
        title="DataQueue processing attempts (current / max)"
      >
        {attemptsLabel}
      </TableCell>
      <TableCell className="text-muted-foreground">
        <OptionalRelativeTime iso={invocation.startedAtIso} />
      </TableCell>
      <TableCell className="hidden text-muted-foreground md:table-cell">
        <OptionalRelativeTime iso={invocation.completedAtIso} />
      </TableCell>
      <TableCell
        className="text-muted-foreground tabular-nums"
        suppressHydrationWarning
      >
        {durationLabel}
      </TableCell>
      <TableCell className={summaryClassName}>
        <span className="block max-w-xs truncate" title={summaryTitle}>
          {summaryText}
        </span>
      </TableCell>
      <TableCell className="pr-2 text-right">
        <Button type="button" variant="ghost" size="sm" onClick={openActivity}>
          Activity
        </Button>
      </TableCell>
    </TableRow>
  );
};

const InvocationsEmptyState = () => {
  return (
    <DataTableCard>
      <Empty className="gap-4 py-10 md:py-12">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Workflow aria-hidden className="size-5 text-muted-foreground" />
          </EmptyMedia>
          <EmptyTitle className="text-base">No invocations</EmptyTitle>
          <EmptyDescription>
            Agent jobs show up here once this execution enqueues them.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    </DataTableCard>
  );
};

export const ScheduleExecutionInvocationsTable = ({
  invocations,
  payloadSource,
}: ScheduleExecutionInvocationsTableProps) => {
  const {
    sortedRows,
    sortField,
    sortDir: sortDirection,
    toggleSort,
  } = useScheduleExecutionInvocationsSort(invocations);
  const invocationDetail = useScheduleExecutionInvocationsModal(payloadSource);
  const activity = useAgentActivityModal();

  if (invocations.length === 0) {
    return <InvocationsEmptyState />;
  }

  const isStartedSortActive = sortField === "startedAt";
  const isCompletedSortActive = sortField === "completedAt";

  const openDetail = (invocation: ScheduleExecutionInvocationRow) => {
    void invocationDetail.openModal(invocation);
  };

  const openActivity = (jobId: string, outcome: string) => {
    void activity.openModal(jobId, outcome);
  };

  return (
    <>
      <DataTableCard>
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="pl-4">Job</TableHead>
              <TableHead>Agent</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="hidden lg:table-cell">Attempts</TableHead>
              <TableHead
                aria-sort={ariaSortFor(isStartedSortActive, sortDirection)}
              >
                <InvocationSortButton
                  field="startedAt"
                  label="Started"
                  isActive={isStartedSortActive}
                  sortDirection={sortDirection}
                  onToggle={toggleSort}
                />
              </TableHead>
              <TableHead
                className="hidden md:table-cell"
                aria-sort={ariaSortFor(isCompletedSortActive, sortDirection)}
              >
                <InvocationSortButton
                  field="completedAt"
                  label="Completed"
                  isActive={isCompletedSortActive}
                  sortDirection={sortDirection}
                  onToggle={toggleSort}
                />
              </TableHead>
              <TableHead>Duration</TableHead>
              <TableHead>Outcome</TableHead>
              <TableHead className="pr-2">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedRows.map((invocation) => (
              <InvocationRow
                key={invocation.jobId}
                invocation={invocation}
                onOpenDetail={openDetail}
                onOpenActivity={openActivity}
              />
            ))}
          </TableBody>
        </Table>
      </DataTableCard>

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
