"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";

import { Button } from "@workspace/ui/components/button";
import { Play } from "lucide-react";

import { useFormAction } from "@/app/dashboard/pipelines/actions/run-pipeline/.generated/use-form-action";

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
  const { FormWithAction, state, pending } = useFormAction();

  useEffect(() => {
    if (state && state.status === true) {
      router.refresh();
    }
  }, [state, router]);

  return { FormWithAction, state, pending };
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
  const { FormWithAction, state, pending } = useRunPipelineButtonState();

  const errorMessage = state && state.status === false ? state.message : null;
  const successInvocations =
    state && state.status === true && state.data
      ? (state.data as { invocationsRun?: number }).invocationsRun
      : null;
  const executionId =
    state && state.status === true && state.data
      ? (state.data as { executionId?: string }).executionId
      : null;
  const runStatus =
    state && state.status === true && state.data
      ? (state.data as { runStatus?: "succeeded" | "partial" | "failed" })
          .runStatus
      : null;
  const failedInvocationCount =
    state && state.status === true && state.data
      ? (state.data as { failedInvocationCount?: number }).failedInvocationCount
      : null;
  const isDisabled = disabled || pending;

  return (
    <div className="flex w-full min-w-0 flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <FormWithAction>
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
            {pending ? "Running…" : "Run pipeline"}
          </Button>
        </FormWithAction>
        {trailingActions}
      </div>
      {errorMessage ? (
        <p className="text-sm text-destructive">{errorMessage}</p>
      ) : null}
      {successInvocations !== null && successInvocations !== undefined ? (
        <div className="rounded-md border border-border bg-muted/40 px-3 py-2">
          <p className="text-sm text-muted-foreground">
            Ran {successInvocations} invocation
            {successInvocations !== 1 ? "s" : ""}.{" "}
            <span className="text-foreground">
              Status {runStatus ?? "unknown"}, {failedInvocationCount ?? 0}{" "}
              failed.
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
