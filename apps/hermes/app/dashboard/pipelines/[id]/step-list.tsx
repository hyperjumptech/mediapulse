"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@workspace/ui/components/button";
import { Label } from "@workspace/ui/components/label";

import { useFormAction as useRemoveStepFormAction } from "@/app/dashboard/pipelines/actions/remove-step/.generated/use-form-action";
import { useFormAction as useUpdateStepFormAction } from "@/app/dashboard/pipelines/actions/update-step/.generated/use-form-action";

type Step = {
  id: string;
  order: number;
  agentId: string;
  agentVersion: string;
  config?: unknown;
};

type Agent = {
  id: string;
  agentId: string;
  agentVersion: string;
  description: string | null;
};

/**
 * Renders the list of pipeline steps with Remove button per step.
 */
export const StepList = ({
  pipelineId,
  steps,
  agentDescriptions,
}: {
  pipelineId: string;
  steps: Step[];
  agentDescriptions: Agent[];
}) => {
  const agentByKey = useMemo(() => {
    const m = new Map<string, Agent>();
    for (const a of agentDescriptions) {
      m.set(`${a.agentId}@${a.agentVersion}`, a);
    }
    return m;
  }, [agentDescriptions]);

  if (steps.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No steps yet. Add an agent from the list below.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {steps.map((step) => (
        <StepRow
          key={step.id}
          pipelineId={pipelineId}
          step={step}
          description={
            agentByKey.get(`${step.agentId}@${step.agentVersion}`)
              ?.description ?? null
          }
          agents={agentDescriptions}
        />
      ))}
    </ul>
  );
};

/**
 * Single step row: order, agent id/version, description, Edit and Remove. Edit form persists step change to DB.
 */
const StepRow = ({
  pipelineId,
  step,
  description,
  agents,
}: {
  pipelineId: string;
  step: Step;
  description: string | null;
  agents: Agent[];
}) => {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [editAgentKey, setEditAgentKey] = useState(
    `${step.agentId}@${step.agentVersion}`,
  );

  const {
    FormWithAction: RemoveForm,
    state: removeState,
    pending: removePending,
  } = useRemoveStepFormAction();
  const {
    FormWithAction: UpdateForm,
    state: updateState,
    pending: updatePending,
  } = useUpdateStepFormAction();

  useEffect(() => {
    if (removeState && removeState.status === true) {
      router.refresh();
    }
  }, [removeState, router]);

  useEffect(() => {
    if (updateState && updateState.status === true) {
      setIsEditing(false);
      router.refresh();
    }
  }, [updateState, router]);

  const updateErrorMessage =
    updateState && updateState.status === false ? updateState.message : null;

  if (isEditing) {
    const [agentId, agentVersion] = editAgentKey.split("@");
    const stepConfigJson =
      step.config != null && typeof step.config === "object"
        ? JSON.stringify(step.config, null, 2)
        : "{}";
    return (
      <li className="flex flex-wrap items-center gap-2 rounded-md border p-3">
        <span className="text-muted-foreground font-mono text-sm w-6">
          {step.order + 1}.
        </span>
        <UpdateForm className="flex flex-wrap items-center gap-2 flex-1 w-full">
          <input
            type="hidden"
            name="body.pipelineId"
            value={pipelineId}
            readOnly
          />
          <input type="hidden" name="body.stepId" value={step.id} readOnly />
          <input
            type="hidden"
            name="body.agentId"
            value={agentId ?? ""}
            readOnly
          />
          <input
            type="hidden"
            name="body.agentVersion"
            value={agentVersion ?? ""}
            readOnly
          />
          <select
            className="flex h-9 w-[280px] rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            value={editAgentKey}
            onChange={(e) => setEditAgentKey(e.target.value)}
            disabled={updatePending}
          >
            {agents.map((a) => (
              <option key={a.id} value={`${a.agentId}@${a.agentVersion}`}>
                {a.agentId}@{a.agentVersion}
                {a.description ? ` — ${a.description}` : ""}
              </option>
            ))}
          </select>
          <div className="w-full grid gap-1.5">
            <Label htmlFor={`step-config-${step.id}`}>Config (JSON)</Label>
            <textarea
              id={`step-config-${step.id}`}
              name="body.config"
              defaultValue={stepConfigJson}
              rows={3}
              disabled={updatePending}
              className="w-full min-w-0 rounded-md border border-input bg-transparent px-3 py-2 text-sm font-mono shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
              placeholder="{}"
            />
          </div>
          <Button
            type="submit"
            variant="secondary"
            size="sm"
            disabled={updatePending}
          >
            {updatePending ? "Saving…" : "Save"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={updatePending}
            onClick={() => setIsEditing(false)}
          >
            Cancel
          </Button>
        </UpdateForm>
        {updateErrorMessage ? (
          <p className="text-sm text-destructive w-full" role="alert">
            {updateErrorMessage}
          </p>
        ) : null}
      </li>
    );
  }

  return (
    <li className="flex items-center gap-4 rounded-md border p-3">
      <span className="text-muted-foreground font-mono text-sm w-6">
        {step.order + 1}.
      </span>
      <div className="flex-1 min-w-0">
        <span className="font-medium">
          {step.agentId}@{step.agentVersion}
        </span>
        {description ? (
          <span className="text-muted-foreground text-sm ml-2">
            {description}
          </span>
        ) : null}
      </div>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setIsEditing(true)}
          aria-label={`Edit step ${step.agentId}@${step.agentVersion}`}
        >
          Edit
        </Button>
        <RemoveForm className="inline">
          <input
            type="hidden"
            name="body.pipelineId"
            value={pipelineId}
            readOnly
          />
          <input type="hidden" name="body.stepId" value={step.id} readOnly />
          <Button
            type="submit"
            variant="destructive"
            size="sm"
            disabled={removePending}
            aria-label={`Remove step ${step.agentId}@${step.agentVersion}`}
          >
            {removePending ? "Removing…" : "Remove"}
          </Button>
        </RemoveForm>
      </div>
    </li>
  );
};
