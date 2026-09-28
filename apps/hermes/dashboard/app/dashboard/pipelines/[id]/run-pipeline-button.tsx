"use client";

import Link from "next/link";
import { useEffect } from "react";
import { CircleAlert, CircleCheck, Clock, Play } from "lucide-react";

import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert";
import { Button } from "@workspace/ui/components/button";

import { useFormAction } from "@/app/dashboard/pipelines/actions/run-pipeline/.generated/use-form-action";

const EXECUTION_LINK_CLASS_NAME =
  "font-medium text-foreground underline underline-offset-4 hover:no-underline";

const preventUnloadWhileRunning = (event: BeforeUnloadEvent) => {
  event.preventDefault();
  event.returnValue = "";
};

export const useRunPipeline = () => {
  const runPipelineAction = useFormAction();
  const { pending } = runPipelineAction;

  useEffect(() => {
    if (!pending) {
      return;
    }
    window.addEventListener("beforeunload", preventUnloadWhileRunning);

    return () =>
      window.removeEventListener("beforeunload", preventUnloadWhileRunning);
  }, [pending]);

  return runPipelineAction;
};

export type RunPipelineAction = ReturnType<typeof useRunPipeline>;

type RunPipelineState = RunPipelineAction["state"];

const describeInvocationCount = (invocationCount: number) =>
  invocationCount === 1 ? "1 invocation" : `${invocationCount} invocations`;

export const RunPipelineButton = ({
  pipelineId,
  disabled = false,
  runPipelineAction,
}: {
  pipelineId: string;
  disabled?: boolean;
  runPipelineAction: RunPipelineAction;
}) => {
  const { FormWithAction, pending } = runPipelineAction;
  const isDisabled = disabled || pending;
  const buttonLabel = pending ? "Running…" : "Run pipeline";

  return (
    <FormWithAction>
      <input type="hidden" name="body.pipelineId" value={pipelineId} readOnly />
      <Button type="submit" disabled={isDisabled}>
        <Play aria-hidden />
        {buttonLabel}
      </Button>
    </FormWithAction>
  );
};

export const RunPipelineResult = ({
  pipelineId,
  state,
}: {
  pipelineId: string;
  state: RunPipelineState;
}) => {
  if (!state) {
    return null;
  }
  if (state.status === false) {
    return (
      <Alert variant="destructive">
        <CircleAlert aria-hidden />
        <AlertTitle>Couldn&apos;t run the pipeline</AlertTitle>
        <AlertDescription>{state.message}</AlertDescription>
      </Alert>
    );
  }
  const { invocationsRun, executionId, runStatus, failedInvocationCount } =
    state.data;
  const executionHref = `/dashboard/pipelines/${pipelineId}/executions/${executionId}`;
  const invocationsLabel = describeInvocationCount(invocationsRun);

  if (runStatus === "running") {
    return (
      <Alert className="border-info/25 bg-info/5 [&>svg]:text-info">
        <Clock aria-hidden />
        <AlertTitle>Pipeline queued</AlertTitle>
        <AlertDescription>
          <p>
            Queued {invocationsLabel} on the worker queue. Agents run in the
            background, so you can refresh this page safely.{" "}
            <Link href={executionHref} className={EXECUTION_LINK_CLASS_NAME}>
              Open execution
            </Link>{" "}
            for live status.
          </p>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Alert>
      <CircleCheck aria-hidden />
      <AlertTitle>Pipeline run finished</AlertTitle>
      <AlertDescription>
        <p>
          Ran {invocationsLabel}.{" "}
          <span className="text-foreground">
            Status {runStatus}, {failedInvocationCount} failed.
          </span>{" "}
          <Link href={executionHref} className={EXECUTION_LINK_CLASS_NAME}>
            Open execution
          </Link>
          .
        </p>
      </AlertDescription>
    </Alert>
  );
};
