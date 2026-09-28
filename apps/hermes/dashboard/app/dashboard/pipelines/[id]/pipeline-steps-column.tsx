"use client";

import { useEffect, useMemo } from "react";
import { ArrowDown, ArrowUp, Trash2 } from "lucide-react";

import { Button } from "@workspace/ui/components/button";
import { cn } from "@workspace/ui/lib/utils";

import { useFormAction as useRemoveStepFormAction } from "@/app/dashboard/pipelines/actions/remove-step/.generated/use-form-action";
import { useFormAction as useReorderStepsFormAction } from "@/app/dashboard/pipelines/actions/reorder-steps/.generated/use-form-action";
import type { AgentConfigSummary } from "@/lib/agent-configs";

import { PipelineColumnCard } from "./pipeline-column-card";

type Step = {
  id: string;
  order: number;
  agentId: string;
  agentVersion: string;
  agentConfigId?: string | null;
  input?: unknown;
  config?: unknown;
};

type Agent = {
  id: string;
  agentId: string;
  agentVersion: string;
  description: string | null;
};

type SelectStepHandler = (stepId: string | null) => void;

type MoveDirection = "up" | "down";

export type PipelineStepsColumnProps = {
  pipelineId: string;
  steps: Step[];
  agentDescriptions: Agent[];
  selectedStepId: string | null;
  onSelectStep: SelectStepHandler;
  configsByAgentKey?: Record<string, AgentConfigSummary[]>;
};

const reorderedStepIds = (
  steps: Step[],
  fromIndex: number,
  direction: MoveDirection,
): string[] => {
  const stepIds = steps.map((step) => step.id);
  const toIndex = direction === "up" ? fromIndex - 1 : fromIndex + 1;
  const movingStepId = stepIds[fromIndex];
  const displacedStepId = stepIds[toIndex];
  if (movingStepId === undefined || displacedStepId === undefined) {
    return stepIds;
  }
  stepIds[fromIndex] = displacedStepId;
  stepIds[toIndex] = movingStepId;

  return stepIds;
};

const usePipelineStepsColumnState = (onSelectStep: SelectStepHandler) => {
  const {
    FormWithAction: RemoveForm,
    state: removeState,
    pending: removePending,
  } = useRemoveStepFormAction();
  const { FormWithAction: ReorderForm, pending: reorderPending } =
    useReorderStepsFormAction();

  useEffect(() => {
    if (removeState && removeState.status === true) {
      onSelectStep(null);
    }
  }, [removeState, onSelectStep]);

  const pending = removePending || reorderPending;

  return { RemoveForm, ReorderForm, pending };
};

const StepCountBadge = ({ stepCount }: { stepCount: number }) => {
  return (
    <span className="rounded-full bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground tabular-nums">
      {stepCount}
    </span>
  );
};

export const PipelineStepsColumn = ({
  pipelineId,
  steps,
  agentDescriptions,
  selectedStepId,
  onSelectStep,
}: PipelineStepsColumnProps) => {
  const agentByKey = useMemo(() => {
    const agentsByKey = new Map<string, Agent>();
    for (const agent of agentDescriptions) {
      agentsByKey.set(`${agent.agentId}@${agent.agentVersion}`, agent);
    }

    return agentsByKey;
  }, [agentDescriptions]);

  const { RemoveForm, ReorderForm, pending } =
    usePipelineStepsColumnState(onSelectStep);
  const title = (
    <>
      Steps
      <StepCountBadge stepCount={steps.length} />
    </>
  );

  if (steps.length === 0) {
    return (
      <PipelineColumnCard title={title}>
        <p className="text-sm text-muted-foreground">
          No steps yet. Add an agent from Available agents to start the
          pipeline.
        </p>
      </PipelineColumnCard>
    );
  }

  return (
    <PipelineColumnCard
      title={title}
      description="Select a step to edit its input, config and contract."
    >
      <ol className="flex flex-col gap-1.5">
        {steps.map((step, index) => {
          const agentKey = `${step.agentId}@${step.agentVersion}`;
          const description = agentByKey.get(agentKey)?.description ?? null;
          const isSelected = selectedStepId === step.id;
          const moveUpStepIds = JSON.stringify(
            reorderedStepIds(steps, index, "up"),
          );
          const moveDownStepIds = JSON.stringify(
            reorderedStepIds(steps, index, "down"),
          );
          const canMoveUp = index > 0;
          const canMoveDown = index < steps.length - 1;
          const stepPosition = step.order + 1;

          return (
            <li
              key={step.id}
              data-selected={isSelected}
              className={cn(
                "flex items-center gap-2 rounded-md border bg-background px-2 py-2 transition-colors",
                isSelected
                  ? "border-primary ring-1 ring-primary"
                  : "hover:bg-muted/50",
              )}
            >
              <span
                aria-hidden
                className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted font-mono text-xs text-muted-foreground tabular-nums"
              >
                {stepPosition}
              </span>
              <button
                type="button"
                aria-pressed={isSelected}
                onClick={() => onSelectStep(isSelected ? null : step.id)}
                className="flex min-w-0 flex-1 flex-col gap-0.5 rounded-sm text-left outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                <span className="truncate font-mono text-sm font-medium">
                  {agentKey}
                </span>
                {description ? (
                  <span className="truncate text-xs text-muted-foreground">
                    {description}
                  </span>
                ) : null}
              </button>
              <div className="flex shrink-0 items-center">
                {canMoveUp ? (
                  <ReorderForm className="inline">
                    <input
                      type="hidden"
                      name="body.pipelineId"
                      value={pipelineId}
                      readOnly
                    />
                    <input
                      type="hidden"
                      name="body.stepIds"
                      value={moveUpStepIds}
                      readOnly
                    />
                    <Button
                      type="submit"
                      variant="ghost"
                      size="icon-sm"
                      className="size-7 text-muted-foreground hover:text-foreground"
                      disabled={pending}
                      aria-label="Move step up"
                    >
                      <ArrowUp aria-hidden />
                    </Button>
                  </ReorderForm>
                ) : null}
                {canMoveDown ? (
                  <ReorderForm className="inline">
                    <input
                      type="hidden"
                      name="body.pipelineId"
                      value={pipelineId}
                      readOnly
                    />
                    <input
                      type="hidden"
                      name="body.stepIds"
                      value={moveDownStepIds}
                      readOnly
                    />
                    <Button
                      type="submit"
                      variant="ghost"
                      size="icon-sm"
                      className="size-7 text-muted-foreground hover:text-foreground"
                      disabled={pending}
                      aria-label="Move step down"
                    >
                      <ArrowDown aria-hidden />
                    </Button>
                  </ReorderForm>
                ) : null}
                <RemoveForm className="inline">
                  <input
                    type="hidden"
                    name="body.pipelineId"
                    value={pipelineId}
                    readOnly
                  />
                  <input
                    type="hidden"
                    name="body.stepId"
                    value={step.id}
                    readOnly
                  />
                  <Button
                    type="submit"
                    variant="ghost"
                    size="icon-sm"
                    className="size-7 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    disabled={pending}
                    aria-label={`Remove step ${agentKey}`}
                  >
                    <Trash2 aria-hidden />
                  </Button>
                </RemoveForm>
              </div>
            </li>
          );
        })}
      </ol>
    </PipelineColumnCard>
  );
};
