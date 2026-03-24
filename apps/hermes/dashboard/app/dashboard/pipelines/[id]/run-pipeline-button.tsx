"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { Button } from "@workspace/ui/components/button";
import { Play } from "lucide-react";

import { useFormAction } from "@/app/dashboard/pipelines/actions/run-pipeline/.generated/use-form-action";

export type RunPipelineButtonProps = {
  pipelineId: string;
  /** When true, button is disabled (e.g. pipeline has validation errors). */
  disabled?: boolean;
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
 * Button that runs the pipeline for all tickers (same behavior as cron). Uses run-pipeline action.
 * Disabled when pipeline is invalid so admin must complete step input/config first.
 */
export const RunPipelineButton = ({
  pipelineId,
  disabled = false,
}: RunPipelineButtonProps) => {
  const { FormWithAction, state, pending } = useRunPipelineButtonState();

  const errorMessage = state && state.status === false ? state.message : null;
  const successTickers =
    state && state.status === true && state.data
      ? (state.data as { tickersRun?: number }).tickersRun
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
    <div className="flex flex-col gap-1">
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
      {errorMessage && (
        <p className="text-sm text-destructive">{errorMessage}</p>
      )}
      {successTickers !== null && successTickers !== undefined && (
        <>
          <p className="text-sm text-muted-foreground">
            Ran for {successTickers} ticker{successTickers !== 1 ? "s" : ""}{" "}
            (status: {runStatus ?? "unknown"}, failures:{" "}
            {failedInvocationCount ?? 0}).
          </p>
          {executionId ? (
            <Link
              href={`/dashboard/pipelines/${pipelineId}/executions/${executionId}`}
              className="text-sm text-primary underline-offset-4 hover:underline"
            >
              View execution
            </Link>
          ) : null}
        </>
      )}
    </div>
  );
};
