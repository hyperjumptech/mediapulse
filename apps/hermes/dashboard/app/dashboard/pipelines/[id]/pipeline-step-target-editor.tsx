"use client";

import Link from "next/link";
import { CircleAlert, CircleCheck } from "lucide-react";

import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert";
import { Button } from "@workspace/ui/components/button";
import {
  Field,
  FieldDescription,
  FieldLabel,
} from "@workspace/ui/components/field";
import {
  NativeSelect,
  NativeSelectOption,
} from "@workspace/ui/components/native-select";
import { Textarea } from "@workspace/ui/components/textarea";

import { formAction as defaultUpdatePipelineStepFormAction } from "@/app/dashboard/pipelines/actions/update-pipeline-step/.generated/form.action";
import type { ComposablePipelineOption } from "@/lib/pipelines";

import { PipelineColumnCard } from "./pipeline-column-card";
import {
  usePipelineStepTargetEditorState,
  type EditablePipelineStep,
  type UpdatePipelineStepFormAction,
} from "./use-pipeline-step-target-editor-state";

export type PipelineStepTargetEditorProps = {
  pipelineId: string;
  step: EditablePipelineStep;
  pipelines: ComposablePipelineOption[];
  includedStepLabels: string[];
  updatePipelineStepFormAction?: UpdatePipelineStepFormAction;
};

const SaveOutcomeAlert = ({
  outcome,
}: {
  outcome: ReturnType<typeof usePipelineStepTargetEditorState>["outcome"];
}) => {
  if (outcome.status === "failed") {
    return (
      <Alert variant="destructive">
        <CircleAlert aria-hidden />
        <AlertTitle>Step not saved</AlertTitle>
        <AlertDescription>{outcome.message}</AlertDescription>
      </Alert>
    );
  }
  if (outcome.status === "saved") {
    return (
      <Alert>
        <CircleCheck aria-hidden />
        <AlertTitle>Step saved</AlertTitle>
      </Alert>
    );
  }

  return null;
};

export const PipelineStepTargetEditor = ({
  pipelineId,
  step,
  pipelines,
  includedStepLabels,
  updatePipelineStepFormAction = defaultUpdatePipelineStepFormAction,
}: PipelineStepTargetEditorProps) => {
  const {
    targetPipelineId,
    setTargetPipelineId,
    overridesText,
    setOverridesText,
    saving,
    outcome,
    save,
  } = usePipelineStepTargetEditorState(
    pipelineId,
    step,
    updatePipelineStepFormAction,
  );
  const targetSelectId = `pipeline-step-target-${step.id}`;
  const overridesId = `pipeline-step-overrides-${step.id}`;

  return (
    <PipelineColumnCard
      title="Selected step"
      description="Runs every step of another pipeline."
      action={
        <Button
          type="button"
          size="sm"
          onClick={save}
          disabled={saving || targetPipelineId === ""}
        >
          {saving ? "Saving…" : "Save"}
        </Button>
      }
    >
      <SaveOutcomeAlert outcome={outcome} />
      <div className="flex flex-col gap-4">
        <Field>
          <FieldLabel htmlFor={targetSelectId}>Pipeline</FieldLabel>
          <NativeSelect
            id={targetSelectId}
            value={targetPipelineId}
            onChange={(event) => setTargetPipelineId(event.target.value)}
            disabled={saving}
          >
            {pipelines.map((pipeline) => (
              <NativeSelectOption key={pipeline.id} value={pipeline.id}>
                {pipeline.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          {targetPipelineId ? (
            <FieldDescription>
              <Link
                href={`/dashboard/pipelines/${targetPipelineId}`}
                className="underline underline-offset-4"
              >
                Open this pipeline
              </Link>
            </FieldDescription>
          ) : null}
        </Field>
        <Field>
          <FieldLabel htmlFor={overridesId}>Input overrides</FieldLabel>
          <Textarea
            id={overridesId}
            value={overridesText}
            onChange={(event) => setOverridesText(event.target.value)}
            disabled={saving}
            rows={6}
            className="font-mono text-xs"
            spellCheck={false}
          />
          <FieldDescription>
            Each key replaces that key in the input of every step it runs. Use{" "}
            <code className="font-mono">{"{{params.name}}"}</code> for a value
            given when the run starts.
          </FieldDescription>
        </Field>
        <section aria-label="Steps it runs" className="flex flex-col gap-1.5">
          <h3 className="text-sm font-medium">Steps it runs</h3>
          {includedStepLabels.length > 0 ? (
            <ol className="flex flex-col gap-1 text-sm">
              {includedStepLabels.map((label, index) => (
                <li
                  key={`${index}-${label}`}
                  className="truncate font-mono text-xs text-muted-foreground"
                >
                  {index + 1}. {label}
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-muted-foreground">
              Save to see the steps it runs.
            </p>
          )}
        </section>
      </div>
    </PipelineColumnCard>
  );
};
