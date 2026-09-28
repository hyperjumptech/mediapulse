"use client";

import { CheckCircle2, XCircle } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog";
import { Separator } from "@workspace/ui/components/separator";
import { Spinner } from "@workspace/ui/components/spinner";

import { LiveElapsed } from "@/components/live-elapsed";
import type { ActivityRow } from "@/components/use-agent-activity-modal";
import { isActivityRowInProgress } from "@/lib/derive-activity-row-durations";
import { formatActivityDuration } from "@/lib/format-activity-duration";

type InvocationActivityOpenChangeHandler = (open: boolean) => void;

type InvocationActivityDialogProps = {
  open: boolean;
  jobId: string | null;
  outcome: string | null;
  rows: ActivityRow[] | null;
  loading: boolean;
  onOpenChange: InvocationActivityOpenChangeHandler;
};

const ACTIVE_OUTCOMES = new Set(["running", "pending"]);

const FAILED_OUTCOMES = new Set(["failure", "cancelled"]);

const ActivityRowStatusIcon = ({
  inProgress,
  failed,
}: {
  inProgress: boolean;
  failed: boolean;
}) => {
  if (inProgress) {
    return (
      <Spinner aria-label="In progress" className="text-muted-foreground" />
    );
  }

  if (failed) {
    return (
      <XCircle
        aria-label="Failed"
        className="size-4 shrink-0 text-destructive"
      />
    );
  }

  return (
    <CheckCircle2
      aria-label="Completed"
      className="size-4 shrink-0 text-success"
    />
  );
};

const ActivityRowDuration = ({
  row,
  inProgress,
}: {
  row: ActivityRow;
  inProgress: boolean;
}) => {
  if (inProgress) {
    return <LiveElapsed startIso={row.createdAt} />;
  }

  if (row.durationMs == null) {
    return null;
  }

  const durationLabel = formatActivityDuration(row.durationMs);

  return (
    <span className="mr-2 text-xs text-muted-foreground tabular-nums">
      {durationLabel}
    </span>
  );
};

const ActivityRowList = ({
  rows,
  outcome,
}: {
  rows: ActivityRow[];
  outcome: string | null;
}) => {
  const jobIsActive = outcome != null && ACTIVE_OUTCOMES.has(outcome);
  const jobFailed = outcome != null && FAILED_OUTCOMES.has(outcome);
  const lastIndex = rows.length - 1;

  return (
    <ol className="flex flex-col">
      {rows.map((row, index) => {
        const inProgress = isActivityRowInProgress(
          row,
          index,
          rows.length,
          jobIsActive,
        );
        const failed = index === lastIndex && jobFailed;

        return (
          <li key={row.id}>
            {index > 0 ? <Separator className="my-3" /> : null}
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <span className="font-medium">{row.title}</span>
                <span className="flex-1" />
                <ActivityRowDuration row={row} inProgress={inProgress} />
                <ActivityRowStatusIcon
                  inProgress={inProgress}
                  failed={failed}
                />
              </div>
              {row.description ? (
                <p className="text-sm text-muted-foreground">
                  {row.description}
                </p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
};

const ActivityBody = ({
  rows,
  outcome,
  loading,
}: {
  rows: ActivityRow[] | null;
  outcome: string | null;
  loading: boolean;
}) => {
  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Spinner
          aria-label="Loading activity"
          className="size-6 text-muted-foreground"
        />
      </div>
    );
  }

  if (rows == null || rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No activity recorded.</p>
    );
  }

  return <ActivityRowList rows={rows} outcome={outcome} />;
};

export const InvocationActivityDialog = ({
  open,
  jobId,
  outcome,
  rows,
  loading,
  onOpenChange,
}: InvocationActivityDialogProps) => {
  const title = jobId ? `Activity for ${jobId.slice(0, 8)}…` : "Activity";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        aria-describedby={undefined}
        className="flex max-h-[85vh] flex-col gap-4 overflow-y-auto sm:max-w-lg"
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <ActivityBody rows={rows} outcome={outcome} loading={loading} />
      </DialogContent>
    </Dialog>
  );
};
