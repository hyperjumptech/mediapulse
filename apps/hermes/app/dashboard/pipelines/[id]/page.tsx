import { notFound } from "next/navigation";

import { withAuthProtection } from "@/components/with-auth-protection";
import { getAgentRegistryList, getPipelineWithSteps } from "@/lib/pipelines";

import { AddStepForm } from "./add-step-form";
import { PipelineEditForm } from "./pipeline-edit-form";
import { RunPipelineButton } from "./run-pipeline-button";
import { StepList } from "./step-list";

/**
 * Pipeline detail/edit page. Loads pipeline with steps and agent registry; renders edit form, step list, and add-step control.
 */
const PipelineDetailPage = async ({
  params,
}: {
  params: Promise<{ id: string }>;
}) => {
  const { id } = await params;
  const [pipeline, agents] = await Promise.all([
    getPipelineWithSteps(id),
    getAgentRegistryList(),
  ]);

  if (!pipeline) {
    notFound();
  }

  return (
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
        <RunPipelineButton pipelineId={pipeline.id} />
      </div>

      <PipelineEditForm
        pipelineId={pipeline.id}
        initialName={pipeline.name}
        initialDescription={pipeline.description ?? ""}
        initialIsActive={pipeline.isActive}
      />

      <section>
        <h2 className="text-lg font-medium text-foreground mb-2">
          Pipeline steps
        </h2>
        <StepList
          pipelineId={pipeline.id}
          steps={pipeline.steps}
          agentDescriptions={agents}
        />
        <AddStepForm
          pipelineId={pipeline.id}
          agents={agents}
          existingStepAgentKeys={pipeline.steps.map(
            (s) => `${s.agentId}@${s.agentVersion}`,
          )}
        />
      </section>
    </div>
  );
};

export default withAuthProtection(PipelineDetailPage);
