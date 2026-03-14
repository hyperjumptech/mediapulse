"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";

import { Button } from "@workspace/ui/components/button";

import { useFormAction as useRemoveStepFormAction } from "@/app/dashboard/pipelines/actions/remove-step/.generated/use-form-action";
import { useFormAction as useReorderStepsFormAction } from "@/app/dashboard/pipelines/actions/reorder-steps/.generated/use-form-action";

import type { AgentConfigSummary } from "@/lib/agent-configs";

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

export type PipelineStepsColumnProps = {
  pipelineId: string;
  steps: Step[];
  agentDescriptions: Agent[];
  selectedStepId: string | null;
  onSelectStep: (stepId: string | null) => void;
  /** Reserved for future use (e.g. show saved config name per step). */
  configsByAgentKey?: Record<string, AgentConfigSummary[]>;
};

/**
 * Builds the step order array after moving the step at fromIndex one position up (negative) or down (positive).
 */
const reorderedStepIds = (
  steps: Step[],
  fromIndex: number,
  direction: "up" | "down",
): string[] => {
  const toIndex = direction === "up" ? fromIndex - 1 : fromIndex + 1;
  if (toIndex < 0 || toIndex >= steps.length) return steps.map((s) => s.id);
  const ids = steps.map((s) => s.id);
  [ids[fromIndex], ids[toIndex]] = [ids[toIndex]!, ids[fromIndex]!];
  return ids;
};

/**
 * Renders the pipeline steps list with select, delete, and reorder (up/down) actions.
 */
export const PipelineStepsColumn = ({
  pipelineId,
  steps,
  agentDescriptions,
  selectedStepId,
  onSelectStep,
}: PipelineStepsColumnProps) => {
  const router = useRouter();
  const agentByKey = useMemo(() => {
    const m = new Map<string, Agent>();
    for (const a of agentDescriptions) {
      m.set(`${a.agentId}@${a.agentVersion}`, a);
    }
    return m;
  }, [agentDescriptions]);

  const {
    FormWithAction: RemoveForm,
    state: removeState,
    pending: removePending,
  } = useRemoveStepFormAction();
  const {
    FormWithAction: ReorderForm,
    state: reorderState,
    pending: reorderPending,
  } = useReorderStepsFormAction();

  useEffect(() => {
    if (removeState && removeState.status === true) {
      onSelectStep(null);
      router.refresh();
    }
  }, [removeState, onSelectStep, router]);

  useEffect(() => {
    if (reorderState && reorderState.status === true) {
      router.refresh();
    }
  }, [reorderState, router]);

  const pending = removePending || reorderPending;

  if (steps.length === 0) {
    return (
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-foreground">Pipeline steps</h3>
        <p className="text-sm text-muted-foreground">
          No steps yet. Add an agent from the left column.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium text-foreground">Pipeline steps</h3>
      <p className="text-xs text-muted-foreground">
        Select a step to edit input and config in the right column.
      </p>
      <ul className="space-y-1.5">
        {steps.map((step, index) => {
          const description =
            agentByKey.get(`${step.agentId}@${step.agentVersion}`)
              ?.description ?? null;
          const isSelected = selectedStepId === step.id;
          const moveUpStepIds = reorderedStepIds(steps, index, "up");
          const moveDownStepIds = reorderedStepIds(steps, index, "down");
          const canMoveUp = index > 0;
          const canMoveDown = index < steps.length - 1;

          return (
            <li
              key={step.id}
              className={`flex flex-wrap items-center gap-2 rounded-md border p-2 ${
                isSelected ? "ring-2 ring-primary" : ""
              }`}
            >
              <span className="text-muted-foreground font-mono text-xs w-5">
                {step.order + 1}.
              </span>
              <button
                type="button"
                onClick={() => onSelectStep(isSelected ? null : step.id)}
                className="flex-1 min-w-0 text-left text-sm font-medium hover:underline"
              >
                {step.agentId}@{step.agentVersion}
                {description ? (
                  <span className="ml-1 text-muted-foreground font-normal truncate">
                    — {description}
                  </span>
                ) : null}
              </button>
              <div className="flex items-center gap-1">
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
                      value={JSON.stringify(moveUpStepIds)}
                      readOnly
                    />
                    <Button
                      type="submit"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      disabled={pending}
                      aria-label="Move step up"
                    >
                      ↑
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
                      value={JSON.stringify(moveDownStepIds)}
                      readOnly
                    />
                    <Button
                      type="submit"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      disabled={pending}
                      aria-label="Move step down"
                    >
                      ↓
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
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    disabled={pending}
                    aria-label={`Remove step ${step.agentId}@${step.agentVersion}`}
                  >
                    Remove
                  </Button>
                </RemoveForm>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
};
