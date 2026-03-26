"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";

import { Button } from "@workspace/ui/components/button";
import { Play } from "lucide-react";

import { useFormAction } from "@/app/dashboard/pipelines/actions/run-pipeline/.generated/use-form-action";
import { useFormAction as useCancelExecutionFormAction } from "@/app/dashboard/pipelines/actions/cancel-execution/.generated/use-form-action";

export type RunPipelineButtonProps = {
  pipelineId: string;
  /** When true, button is disabled (e.g. pipeline has validation errors). */
  disabled?: boolean;
  /** Renders after the Run control on the same row (e.g. Save). */
  trailingActions?: ReactNode;
};

/**
 * Encapsulates run-pipeline form action and refresh-on-success.
 */
const useRunPipelineButtonState = () => {
  const router = useRouter();
  const {
    FormWithAction: RunFormWithAction,
    state: runState,
    pending: runPending,
  } = useFormAction();
  const {
    FormWithAction: CancelFormWithAction,
    state: cancelState,
    pending: cancelPending,
  } = useCancelExecutionFormAction();

  useEffect(() => {
    if (
      (runState && runState.status === true) ||
      (cancelState && cancelState.status === true)
    ) {
      router.refresh();
    }
  }, [runState, cancelState, router]);

  return {
    RunFormWithAction,
    CancelFormWithAction,
    runState,
    runPending,
    cancelPending,
  };
};

/**
 * Button that runs the pipeline and shows manual execution result metadata.
 * Disabled when pipeline is invalid so admin must complete step input/config first.
 */
export const RunPipelineButton = ({
  pipelineId,
  disabled = false,
  trailingActions = null,
}: RunPipelineButtonProps) => {
  const {
    RunFormWithAction,
    CancelFormWithAction,
    runState,
    runPending,
    cancelPending,
  } = useRunPipelineButtonState();

  const errorMessage =
    runState && runState.status === false ? runState.message : null;
  const queuedInvocations =
    runState && runState.status === true && runState.data
      ? (runState.data as { invocationsQueued?: number }).invocationsQueued
      : null;
  const executionId =
    runState && runState.status === true && runState.data
      ? (runState.data as { executionId?: string }).executionId
      : null;
  const runStatus =
    runState && runState.status === true && runState.data
      ? (runState.data as { runStatus?: "pending" | "failed" }).runStatus
      : null;
  const isDisabled = disabled || runPending;
  const canCancel = executionId != null && runStatus === "pending";

  return (
    <div className="flex w-full min-w-0 flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <RunFormWithAction>
          <input
            type="hidden"
            name="body.pipelineId"
            value={pipelineId}
            readOnly
          />
          <Button
            type="submit"
            variant="default"
            disabled={isDisabled}
            title={
              disabled
                ? "Complete all step input and config to run the pipeline"
                : undefined
            }
          >
            <Play className="mr-2 size-4" />
            {runPending ? "Running…" : "Run pipeline"}
          </Button>
        </RunFormWithAction>
        {canCancel ? (
          <CancelFormWithAction>
            <input
              type="hidden"
              name="body.executionId"
              value={executionId}
              readOnly
            />
            <Button type="submit" variant="outline" disabled={cancelPending}>
              {cancelPending ? "Cancelling…" : "Cancel execution"}
            </Button>
          </CancelFormWithAction>
        ) : null}
        {trailingActions}
      </div>
      {errorMessage ? (
        <p className="text-sm text-destructive">{errorMessage}</p>
      ) : null}
      {queuedInvocations !== null && queuedInvocations !== undefined ? (
        <div className="rounded-md border border-border bg-muted/40 px-3 py-2">
          <p className="text-sm text-muted-foreground">
            Queued {queuedInvocations} invocation
            {queuedInvocations !== 1 ? "s" : ""}.{" "}
            <span className="text-foreground">
              Status {runStatus ?? "unknown"}.
            </span>
            {executionId ? (
              <>
                {" "}
                <Link
                  href={`/dashboard/pipelines/${pipelineId}/executions/${executionId}`}
                  className="font-medium text-primary underline-offset-4 hover:underline"
                >
                  Open execution
                </Link>
                .
              </>
            ) : null}
          </p>
        </div>
      ) : null}
    </div>
  );
};
