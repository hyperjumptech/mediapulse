"use client";

import { useCallback, useMemo, useState } from "react";
import { Plus } from "lucide-react";

import { Button } from "@workspace/ui/components/button";

import { formAction as defaultAddStepFormAction } from "@/app/dashboard/pipelines/actions/add-step/.generated/form.action";

import { PipelineColumnCard } from "./pipeline-column-card";

type Agent = {
  id: string;
  agentId: string;
  agentVersion: string;
  description: string | null;
};

type AddStepFormAction = typeof defaultAddStepFormAction;

export type PipelineAvailableAgentsProps = {
  pipelineId: string;
  agents: Agent[];
  existingStepAgentKeys: string[];
  addStepFormAction?: AddStepFormAction;
};

const buildAddStepFormData = (
  pipelineId: string,
  agentId: string,
  agentVersion: string,
): FormData => {
  const formData = new FormData();
  formData.set("body.pipelineId", pipelineId);
  formData.set("body.agentId", agentId);
  formData.set("body.agentVersion", agentVersion);
  formData.set("body.agentConfigId", "");
  formData.set("body.input", "{}");
  formData.set("body.config", "{}");

  return formData;
};

const readErrorMessage = (state: unknown): string | null => {
  const isFailedState =
    state != null &&
    typeof state === "object" &&
    "status" in state &&
    state.status === false &&
    "message" in state;

  return isFailedState ? String(state.message) : null;
};

const usePipelineAvailableAgentsState = (
  pipelineId: string,
  agents: Agent[],
  existingStepAgentKeys: string[],
  addStepFormAction: AddStepFormAction,
) => {
  const [state, setState] = useState<unknown>(null);
  const [pending, setPending] = useState(false);

  const availableAgents = useMemo(
    () =>
      agents.filter((agent) => {
        const agentKey = `${agent.agentId}@${agent.agentVersion}`;

        return !existingStepAgentKeys.includes(agentKey);
      }),
    [agents, existingStepAgentKeys],
  );

  const handleAddAgent = useCallback(
    async (agent: Agent) => {
      setPending(true);
      setState(null);
      try {
        const formData = buildAddStepFormData(
          pipelineId,
          agent.agentId,
          agent.agentVersion,
        );
        const result = await addStepFormAction(null, formData);
        setState(result);
      } finally {
        setPending(false);
      }
    },
    [pipelineId, addStepFormAction],
  );

  const errorMessage = readErrorMessage(state);

  return { availableAgents, pending, handleAddAgent, errorMessage };
};

const describeEmptyAgents = (registeredAgentCount: number) =>
  registeredAgentCount === 0
    ? "No active agents are registered for this pipeline's integration."
    : "All registered agents are already in this pipeline.";

export const PipelineAvailableAgents = ({
  pipelineId,
  agents,
  existingStepAgentKeys,
  addStepFormAction = defaultAddStepFormAction,
}: PipelineAvailableAgentsProps) => {
  const { availableAgents, pending, handleAddAgent, errorMessage } =
    usePipelineAvailableAgentsState(
      pipelineId,
      agents,
      existingStepAgentKeys,
      addStepFormAction,
    );
  const hasAvailableAgents = availableAgents.length > 0;

  return (
    <PipelineColumnCard
      title="Available agents"
      description="Click an agent to add it as the last step."
    >
      {errorMessage ? (
        <p className="text-sm text-destructive" role="alert">
          {errorMessage}
        </p>
      ) : null}
      {hasAvailableAgents ? (
        <ul className="flex flex-col gap-1.5">
          {availableAgents.map((agent) => {
            const agentLabel = `${agent.agentId}@${agent.agentVersion}`;

            return (
              <li key={agent.id}>
                <Button
                  type="button"
                  variant="outline"
                  className="group h-auto w-full justify-between gap-3 px-3 py-2 text-left font-normal whitespace-normal"
                  disabled={pending}
                  aria-label={`Add ${agentLabel} to the pipeline`}
                  onClick={() => handleAddAgent(agent)}
                >
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="truncate font-mono text-sm">
                      {agentLabel}
                    </span>
                    {agent.description ? (
                      <span className="line-clamp-2 text-xs text-muted-foreground">
                        {agent.description}
                      </span>
                    ) : null}
                  </span>
                  <Plus
                    aria-hidden
                    className="text-muted-foreground group-hover:text-foreground"
                  />
                </Button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">
          {describeEmptyAgents(agents.length)}
        </p>
      )}
    </PipelineColumnCard>
  );
};
