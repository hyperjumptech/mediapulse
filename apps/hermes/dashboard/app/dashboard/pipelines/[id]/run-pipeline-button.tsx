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
import { Dialog } from "@workspace/ui/components/dialog";
import { Field, FieldLabel } from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";

import { useFormAction } from "@/app/dashboard/pipelines/actions/run-pipeline/.generated/use-form-action";
import {
  FormDialogBody,
  FormDialogCancelButton,
  FormDialogContent,
  FormDialogFooter,
  FormDialogHeader,
  formDialogFormClassName,
} from "@/components/form-dialog";
import { SubmitButton } from "@/components/submit-button";

import { useRunPipelineParamsDialog } from "./use-run-pipeline-params-dialog";

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

type RunPipelineButtonProps = {
  pipelineId: string;
  disabled?: boolean;
  runPipelineAction: RunPipelineAction;
  runParamKeys?: string[];
};

const RunPipelineWithParamsButton = ({
  pipelineId,
  disabled = false,
  runPipelineAction,
  runParamKeys,
}: Required<RunPipelineButtonProps>) => {
  const { FormWithAction, pending, state } = runPipelineAction;
  const { open, setOpen, closeDialog, errorMessage } =
    useRunPipelineParamsDialog({ pending, state });
  const isDisabled = disabled || pending;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button type="button" disabled={isDisabled} onClick={() => setOpen(true)}>
        <Play aria-hidden />
        Run pipeline
      </Button>
      <FormDialogContent hasDescription>
        <FormDialogHeader
          title="Run pipeline"
          description="Its steps use these run parameters. Each value is sent as text."
        />
        <FormWithAction className={formDialogFormClassName}>
          <input
            type="hidden"
            name="body.pipelineId"
            value={pipelineId}
            readOnly
          />
          <FormDialogBody className="flex flex-col gap-4">
            {runParamKeys.map((runParamKey) => {
              const inputId = `run-param-${runParamKey}`;

              return (
                <Field key={runParamKey}>
                  <FieldLabel htmlFor={inputId} className="font-mono">
                    {runParamKey}
                  </FieldLabel>
                  <Input
                    id={inputId}
                    name={`body.params.${runParamKey}`}
                    required
                    autoComplete="off"
                    disabled={pending}
                  />
                </Field>
              );
            })}
          </FormDialogBody>
          <FormDialogFooter errorMessage={errorMessage}>
            <FormDialogCancelButton onCancel={closeDialog} disabled={pending} />
            <SubmitButton pending={pending} pendingLabel="Running…">
              Run
            </SubmitButton>
          </FormDialogFooter>
        </FormWithAction>
      </FormDialogContent>
    </Dialog>
  );
};

export const RunPipelineButton = ({
  pipelineId,
  disabled = false,
  runPipelineAction,
  runParamKeys = [],
}: RunPipelineButtonProps) => {
  if (runParamKeys.length > 0) {
    return (
      <RunPipelineWithParamsButton
        pipelineId={pipelineId}
        disabled={disabled}
        runPipelineAction={runPipelineAction}
        runParamKeys={runParamKeys}
      />
    );
  }
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
