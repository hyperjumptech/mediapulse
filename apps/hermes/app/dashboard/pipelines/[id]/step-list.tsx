"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";

import { Button } from "@workspace/ui/components/button";

import { useFormAction } from "@/app/dashboard/pipelines/actions/remove-step/.generated/use-form-action";

type Step = {
  id: string;
  order: number;
  agentId: string;
  agentVersion: string;
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
        />
      ))}
    </ul>
  );
};

/**
 * Single step row: order, agent id/version, description, Remove form.
 */
const StepRow = ({
  pipelineId,
  step,
  description,
}: {
  pipelineId: string;
  step: Step;
  description: string | null;
}) => {
  const router = useRouter();
  const { FormWithAction, state, pending } = useFormAction();

  useEffect(() => {
    if (state && state.status === true) {
      router.refresh();
    }
  }, [state, router]);

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
      <FormWithAction className="inline">
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
          disabled={pending}
          aria-label={`Remove step ${step.agentId}@${step.agentVersion}`}
        >
          {pending ? "Removing…" : "Remove"}
        </Button>
      </FormWithAction>
    </li>
  );
};
