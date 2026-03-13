import { notFound } from "next/navigation";

import { withAuthProtection } from "@/components/with-auth-protection";
import { getAgentConfigsByAgentKeys } from "@/lib/agent-configs";
import { getAgentRegistryList, getPipelineWithSteps } from "@/lib/pipelines";
import { validatePipeline } from "@/lib/validate-pipeline";
import { prisma } from "@workspace/database";

import { PipelineDetailContent } from "./pipeline-detail-content";

/**
 * Pipeline detail page. Loads pipeline with steps, agent registry, validation, and agent configs for step assignment.
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

  const [configsByAgentKey, validation] = await Promise.all([
    getAgentConfigsByAgentKeys(
      agents.map((a) => ({ agentId: a.agentId, agentVersion: a.agentVersion })),
    ),
    validatePipeline(pipeline, prisma),
  ]);

  return (
    <PipelineDetailContent
      pipeline={pipeline}
      agents={agents}
      configsByAgentKey={configsByAgentKey}
      pipelineValidation={validation}
    />
  );
};

export default withAuthProtection(PipelineDetailPage);
