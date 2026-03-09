"use client";

import { useState } from "react";

import { Button } from "@workspace/ui/components/button";

import type { AgentConfigSummary } from "@/lib/agent-configs";
import type {
  getAgentRegistryList,
  getPipelineWithSteps,
} from "@/lib/pipelines";

import { PipelineFormModal } from "../pipeline-form-modal";
import { AddStepForm } from "./add-step-form";
import { RunPipelineButton } from "./run-pipeline-button";
import { StepList } from "./step-list";

type PipelineWithSteps = NonNullable<
  Awaited<ReturnType<typeof getPipelineWithSteps>>
>;
type AgentRegistryEntry = Awaited<
  ReturnType<typeof getAgentRegistryList>
>[number];

export type PipelineDetailContentProps = {
  pipeline: PipelineWithSteps;
  agents: AgentRegistryEntry[];
  configsByAgentKey: Record<string, AgentConfigSummary[]>;
};

/**
 * Client wrapper for pipeline detail: header with Edit details button, step list, add-step form, and edit modal.
 */
export const PipelineDetailContent = ({
  pipeline,
  agents,
  configsByAgentKey,
}: PipelineDetailContentProps) => {
  const [editModalOpen, setEditModalOpen] = useState(false);

  return (
    <>
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">
              {pipeline.name}
            </h1>
            <p className="text-muted-foreground">
              {pipeline.description ?? "Edit pipeline and manage agent steps."}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setEditModalOpen(true)}>
              Edit details
            </Button>
            <RunPipelineButton pipelineId={pipeline.id} />
          </div>
        </div>

        <section>
          <h2 className="text-lg font-medium text-foreground mb-2">
            Pipeline steps
          </h2>
          <StepList
            pipelineId={pipeline.id}
            steps={pipeline.steps}
            agentDescriptions={agents}
            configsByAgentKey={configsByAgentKey}
          />
          <AddStepForm
            pipelineId={pipeline.id}
            agents={agents}
            existingStepAgentKeys={pipeline.steps.map(
              (s) => `${s.agentId}@${s.agentVersion}`,
            )}
            configsByAgentKey={configsByAgentKey}
          />
        </section>
      </div>
      <PipelineFormModal
        open={editModalOpen}
        onOpenChange={setEditModalOpen}
        mode="edit"
        editPipelineId={pipeline.id}
      />
    </>
  );
};
