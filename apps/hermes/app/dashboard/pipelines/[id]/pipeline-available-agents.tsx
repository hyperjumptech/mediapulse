"use client";

import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";

import { Button } from "@workspace/ui/components/button";

import { formAction as addStepFormAction } from "@/app/dashboard/pipelines/actions/add-step/.generated/form.action";

type Agent = {
  id: string;
  agentId: string;
  agentVersion: string;
  description: string | null;
};

export type PipelineAvailableAgentsProps = {
  pipelineId: string;
  agents: Agent[];
  existingStepAgentKeys: string[];
};

/**
 * Builds FormData for the add-step action (body.pipelineId, body.agentId, etc.).
 */
function buildAddStepFormData(
  pipelineId: string,
  agentId: string,
  agentVersion: string,
): FormData {
  const formData = new FormData();
  formData.set("body.pipelineId", pipelineId);
  formData.set("body.agentId", agentId);
  formData.set("body.agentVersion", agentVersion);
  formData.set("body.agentConfigId", "");
  formData.set("body.input", "{}");
  formData.set("body.config", "{}");
  return formData;
}

/**
 * Renders a list of agents not yet in the pipeline. Each agent can be added via a one-click button that invokes the add-step action.
 */
export const PipelineAvailableAgents = ({
  pipelineId,
  agents,
  existingStepAgentKeys,
}: PipelineAvailableAgentsProps) => {
  const router = useRouter();
  const [state, setState] = useState<unknown>(null);
  const [pending, setPending] = useState(false);

  const availableAgents = useMemo(
    () =>
      agents.filter(
        (a) =>
          !existingStepAgentKeys.includes(`${a.agentId}@${a.agentVersion}`),
      ),
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
        if (
          result &&
          typeof result === "object" &&
          "status" in result &&
          (result as { status: boolean }).status === true
        ) {
          router.refresh();
        }
      } finally {
        setPending(false);
      }
    },
    [pipelineId, router],
  );

  const errorMessage =
    state &&
    typeof state === "object" &&
    "status" in state &&
    (state as { status: boolean }).status === false &&
    "message" in state
      ? String((state as { message: string }).message)
      : null;

  if (availableAgents.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        All registered agents are already in this pipeline.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium text-foreground">Available agents</h3>
      <p className="text-xs text-muted-foreground">
        Click an agent to add it to the pipeline.
      </p>
      {errorMessage ? (
        <p className="text-sm text-destructive" role="alert">
          {errorMessage}
        </p>
      ) : null}
      <ul className="space-y-1.5">
        {availableAgents.map((agent) => (
          <li key={agent.id}>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full justify-start text-left font-normal"
              disabled={pending}
              onClick={() => handleAddAgent(agent)}
            >
              <span className="font-mono text-sm">
                {agent.agentId}@{agent.agentVersion}
              </span>
              {agent.description ? (
                <span className="ml-2 text-muted-foreground truncate">
                  — {agent.description}
                </span>
              ) : null}
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
};
