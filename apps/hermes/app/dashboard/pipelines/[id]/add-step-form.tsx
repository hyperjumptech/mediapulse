"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@workspace/ui/components/button";
import { Label } from "@workspace/ui/components/label";

import { useFormAction } from "@/app/dashboard/pipelines/actions/add-step/.generated/use-form-action";

type Agent = {
  id: string;
  agentId: string;
  agentVersion: string;
  description: string | null;
};

/**
 * Add step form: select agent from registry (excluding already-added), submit to add-step; refreshes on success.
 */
export const AddStepForm = ({
  pipelineId,
  agents,
  existingStepAgentKeys,
}: {
  pipelineId: string;
  agents: Agent[];
  existingStepAgentKeys: string[];
}) => {
  const router = useRouter();
  const { FormWithAction, state, pending } = useFormAction();
  const [selected, setSelected] = useState<{
    agentId: string;
    agentVersion: string;
  } | null>(null);

  const availableAgents = useMemo(
    () =>
      agents.filter(
        (a) =>
          !existingStepAgentKeys.includes(`${a.agentId}@${a.agentVersion}`),
      ),
    [agents, existingStepAgentKeys],
  );

  const errorMessage = useMemo(() => {
    if (state && state.status === false) return state.message;
    return null;
  }, [state]);

  useEffect(() => {
    if (state && state.status === true) {
      setSelected(null);
      router.refresh();
    }
  }, [state, router]);

  return (
    <FormWithAction className="flex flex-col gap-2 mt-4">
      <input type="hidden" name="body.pipelineId" value={pipelineId} readOnly />
      <input
        type="hidden"
        name="body.agentId"
        value={selected?.agentId ?? ""}
        readOnly
      />
      <input
        type="hidden"
        name="body.agentVersion"
        value={selected?.agentVersion ?? ""}
        readOnly
      />
      <div className="flex flex-wrap items-end gap-2">
        <div className="grid gap-1.5">
          <Label htmlFor="add-step-agent">Add agent</Label>
          <select
            id="add-step-agent"
            className="flex h-9 w-[280px] rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            value={
              selected ? `${selected.agentId}@${selected.agentVersion}` : ""
            }
            onChange={(e) => {
              const v = e.target.value;
              if (!v) {
                setSelected(null);
                return;
              }
              const [agentId, agentVersion] = v.split("@");
              if (agentId && agentVersion) {
                setSelected({ agentId, agentVersion });
              }
            }}
            disabled={pending}
          >
            <option value="">Select an agent…</option>
            {availableAgents.map((a) => (
              <option key={a.id} value={`${a.agentId}@${a.agentVersion}`}>
                {a.agentId}@{a.agentVersion}
                {a.description ? ` — ${a.description}` : ""}
              </option>
            ))}
          </select>
        </div>
        <Button
          type="submit"
          variant="secondary"
          size="sm"
          disabled={pending || !selected}
        >
          {pending ? "Adding…" : "Add step"}
        </Button>
      </div>
      {availableAgents.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          All registered agents are already in this pipeline.
        </p>
      ) : null}
      {errorMessage ? (
        <p className="text-sm text-destructive" role="alert">
          {errorMessage}
        </p>
      ) : null}
    </FormWithAction>
  );
};
