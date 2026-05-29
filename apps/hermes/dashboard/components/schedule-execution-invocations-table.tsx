"use client";

import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { format } from "date-fns";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog";
import { Separator } from "@workspace/ui/components/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table";
import { Button } from "@workspace/ui/components/button";

import {
  computeJobElapsedDisplay,
  formatJobElapsedCell,
} from "@/lib/compute-execution-elapsed";
import { formatQueueAttemptsDisplay } from "@/lib/format-queue-attempts-display";
import { resolveInvocationOutcomeLabel } from "@/lib/invocation-display-status";

import { formatActivityDuration } from "@/lib/format-activity-duration";

import {
  useScheduleExecutionInvocationsSort,
  type ScheduleExecutionInvocationSortField,
  type ScheduleExecutionInvocationSortDir,
} from "./use-schedule-execution-invocations-sort";
import {
  useScheduleExecutionInvocationsModal,
  type ScheduleExecutionInvocationRow,
} from "./use-schedule-execution-invocations-modal";
import { isActivityRowInProgress } from "@/lib/derive-activity-row-durations";

import { useAgentActivityModal } from "./use-agent-activity-modal";
import { LiveElapsed } from "./live-elapsed";

/**
 * Pretty-prints JSON for read-only display in the modal.
 *
 * @param value - Masked input or config object.
 */
const formatJsonBlock = (value: unknown): string => {
  try {
    return JSON.stringify(value ?? null, null, 2);
  } catch {
    return String(value);
  }
};

const DATE_DISPLAY = "LLL d, yyyy HH:mm:ss";

/**
 * Formats an ISO timestamp for the table, or an em dash when missing.
 *
 * @param iso - ISO-8601 string from the server, or null.
 */
const formatOptionalIso = (iso: string | null): string => {
  if (iso == null) {
    return "—";
  }
  return format(new Date(iso), DATE_DISPLAY);
};

type TimestampSortHeaderProps = {
  field: ScheduleExecutionInvocationSortField;
  label: string;
  activeField: ScheduleExecutionInvocationSortField;
  sortDir: ScheduleExecutionInvocationSortDir;
  onToggle: (field: ScheduleExecutionInvocationSortField) => void;
};

/**
 * Accessible sort control for Started at / Completed at columns.
 */
const TimestampSortHeader = ({
  field,
  label,
  activeField,
  sortDir,
  onToggle,
}: TimestampSortHeaderProps) => {
  const isActive = activeField === field;
  const Icon = isActive
    ? sortDir === "asc"
      ? ArrowUp
      : ArrowDown
    : ArrowUpDown;

  return (
    <Button
      type="button"
      variant="ghost"
      className="-ml-3 h-8 gap-1 px-3 font-medium hover:text-foreground"
      onClick={() => {
        onToggle(field);
      }}
      aria-sort={
        isActive ? (sortDir === "asc" ? "ascending" : "descending") : undefined
      }
    >
      {label}
      <Icon className="size-4 shrink-0 opacity-70" aria-hidden />
    </Button>
  );
};

export type ScheduleExecutionInvocationsTableProps = {
  invocations: ScheduleExecutionInvocationRow[];
};

/**
 * Table of schedule execution invocations; clicking a job id opens a dialog with masked input and config JSON.
 */
export const ScheduleExecutionInvocationsTable = ({
  invocations,
}: ScheduleExecutionInvocationsTableProps) => {
  const { sortedRows, sortField, sortDir, toggleSort } =
    useScheduleExecutionInvocationsSort(invocations);
  const { open, selected, openModal, onOpenChange } =
    useScheduleExecutionInvocationsModal();
  const {
    open: activityOpen,
    jobId: activityJobId,
    rows: activityRows,
    loading: activityLoading,
    openModal: openActivityModal,
    onOpenChange: onActivityOpenChange,
  } = useAgentActivityModal();

  return (
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Job</TableHead>
              <TableHead>Agent</TableHead>
              <TableHead>Attempts</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>
                <TimestampSortHeader
                  field="startedAt"
                  label="Started at"
                  activeField={sortField}
                  sortDir={sortDir}
                  onToggle={toggleSort}
                />
              </TableHead>
              <TableHead>
                <TimestampSortHeader
                  field="completedAt"
                  label="Completed at"
                  activeField={sortField}
                  sortDir={sortDir}
                  onToggle={toggleSort}
                />
              </TableHead>
              <TableHead>Duration</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead>Activity</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invocations.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-muted-foreground">
                  No invocations.
                </TableCell>
              </TableRow>
            ) : (
              sortedRows.map((j) => {
                const outcome = resolveInvocationOutcomeLabel(
                  j.status,
                  j.semanticStatus,
                );
                const isTerminalOutcome =
                  outcome === "success" || outcome === "failure";
                const startedAt =
                  j.startedAtIso != null ? new Date(j.startedAtIso) : null;
                const completedAt =
                  j.completedAtIso != null ? new Date(j.completedAtIso) : null;
                const durationLabel = formatJobElapsedCell(
                  computeJobElapsedDisplay(startedAt, completedAt),
                );

                return (
                  <TableRow key={j.jobId}>
                    <TableCell className="max-w-[min(100vw,28rem)]">
                      <Button
                        type="button"
                        variant="link"
                        className="h-auto min-h-0 p-0 font-mono text-xs wrap-break-word whitespace-normal text-left"
                        onClick={() => {
                          openModal(j);
                        }}
                      >
                        {j.jobId}
                      </Button>
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {j.agentId}
                    </TableCell>
                    <TableCell
                      className="text-sm text-muted-foreground tabular-nums"
                      title="DataQueue processing attempts (current / max)"
                    >
                      {formatQueueAttemptsDisplay(
                        j.dataQueueAttempts,
                        j.dataQueueMaxAttempts,
                      )}
                    </TableCell>
                    <TableCell
                      className={
                        isTerminalOutcome
                          ? "text-sm lowercase"
                          : "text-sm capitalize"
                      }
                    >
                      {outcome}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatOptionalIso(j.startedAtIso)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatOptionalIso(j.completedAtIso)}
                    </TableCell>
                    <TableCell className="text-sm tabular-nums text-muted-foreground">
                      {durationLabel}
                    </TableCell>
                    <TableCell className="max-w-md whitespace-normal wrap-break-word text-sm text-muted-foreground">
                      {j.errorSummary ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          void openActivityModal(j.jobId);
                        }}
                      >
                        Show activity
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="flex max-h-[85vh] max-w-2xl flex-col gap-4 overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {selected
                ? `Invocation ${selected.jobId.slice(0, 8)}…`
                : "Invocation"}
            </DialogTitle>
            <p className="text-sm text-muted-foreground">
              Input and config as stored for this job. Values that look like
              credentials are hidden.
            </p>
          </DialogHeader>
          {selected ? (
            <div className="flex flex-col gap-4">
              <div>
                <h3 className="mb-2 text-sm font-medium text-foreground">
                  Input
                </h3>
                <pre className="max-h-48 overflow-auto rounded-md border bg-muted/40 p-3 font-mono text-xs leading-relaxed">
                  {formatJsonBlock(selected.inputMasked)}
                </pre>
              </div>
              <div>
                <h3 className="mb-2 text-sm font-medium text-foreground">
                  Config
                </h3>
                {selected.configMasked == null ? (
                  <p className="text-sm text-muted-foreground">
                    No config stored for this invocation (older executions only
                    saved input).
                  </p>
                ) : (
                  <pre className="max-h-48 overflow-auto rounded-md border bg-muted/40 p-3 font-mono text-xs leading-relaxed">
                    {formatJsonBlock(selected.configMasked)}
                  </pre>
                )}
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={activityOpen} onOpenChange={onActivityOpenChange}>
        <DialogContent className="flex max-h-[85vh] max-w-lg flex-col gap-4 overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {activityJobId
                ? `Activity for ${activityJobId.slice(0, 8)}…`
                : "Activity"}
            </DialogTitle>
          </DialogHeader>
          {activityLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : activityRows == null || activityRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No activity recorded.
            </p>
          ) : (
            <div className="flex flex-col">
              {activityRows.map((row, index) => {
                const inProgress = isActivityRowInProgress(
                  row,
                  index,
                  activityRows.length,
                );
                const showLiveElapsed = inProgress;
                const durationLabel =
                  !showLiveElapsed && row.durationMs != null
                    ? formatActivityDuration(row.durationMs)
                    : null;

                return (
                  <div key={row.id}>
                    {index > 0 ? <Separator className="my-3" /> : null}
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{row.title}</span>
                        <span className="flex-1" />
                        {showLiveElapsed ? (
                          <LiveElapsed startIso={row.createdAt} />
                        ) : durationLabel ? (
                          <span className="text-xs tabular-nums text-muted-foreground mr-2">
                            {durationLabel}
                          </span>
                        ) : null}
                        {inProgress ? (
                          <Loader2 className="size-4 animate-spin text-muted-foreground" />
                        ) : (
                          <CheckCircle2 className="size-4 text-green-500" />
                        )}
                      </div>
                      {row.description ? (
                        <p className="text-sm text-muted-foreground">
                          {row.description}
                        </p>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
