"use client";

import { Plus, Workflow } from "lucide-react";

import { Button } from "@workspace/ui/components/button";

import { formAction as defaultAddPipelineStepFormAction } from "@/app/dashboard/pipelines/actions/add-pipeline-step/.generated/form.action";
import type { ComposablePipelineOption } from "@/lib/pipelines";

import { PipelineColumnCard } from "./pipeline-column-card";
import {
  usePipelineAvailablePipelinesState,
  type AddPipelineStepFormAction,
} from "./use-pipeline-available-pipelines-state";

export type PipelineAvailablePipelinesProps = {
  pipelineId: string;
  pipelines: ComposablePipelineOption[];
  addPipelineStepFormAction?: AddPipelineStepFormAction;
};

export const PipelineAvailablePipelines = ({
  pipelineId,
  pipelines,
  addPipelineStepFormAction = defaultAddPipelineStepFormAction,
}: PipelineAvailablePipelinesProps) => {
  const { pending, handleAddPipeline, errorMessage } =
    usePipelineAvailablePipelinesState(pipelineId, addPipelineStepFormAction);

  return (
    <PipelineColumnCard
      title="Available pipelines"
      description="Click a pipeline to run all of its steps as the last step."
    >
      {errorMessage ? (
        <p className="text-sm text-destructive" role="alert">
          {errorMessage}
        </p>
      ) : null}
      {pipelines.length > 0 ? (
        <ul className="flex flex-col gap-1.5">
          {pipelines.map((pipeline) => (
            <li key={pipeline.id}>
              <Button
                type="button"
                variant="outline"
                className="group h-auto w-full justify-between gap-3 px-3 py-2 text-left font-normal whitespace-normal"
                disabled={pending}
                aria-label={`Add pipeline ${pipeline.name} as a step`}
                onClick={() => handleAddPipeline(pipeline.id)}
              >
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="flex min-w-0 items-center gap-1.5 text-sm">
                    <Workflow
                      aria-hidden
                      className="size-4 shrink-0 text-muted-foreground"
                    />
                    <span className="truncate">{pipeline.name}</span>
                  </span>
                  {pipeline.description ? (
                    <span className="line-clamp-2 text-xs text-muted-foreground">
                      {pipeline.description}
                    </span>
                  ) : null}
                </span>
                <Plus
                  aria-hidden
                  className="text-muted-foreground group-hover:text-foreground"
                />
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">
          No other pipelines use this pipeline&apos;s integration.
        </p>
      )}
    </PipelineColumnCard>
  );
};
