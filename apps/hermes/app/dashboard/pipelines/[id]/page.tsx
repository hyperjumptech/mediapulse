import { notFound } from "next/navigation";

import { withAuthProtection } from "@/components/with-auth-protection";
import { getAgentConfigsByAgentKeys } from "@/lib/agent-configs";
import { getAgentRegistryList, getPipelineWithSteps } from "@/lib/pipelines";

import { PipelineDetailContent } from "./pipeline-detail-content";

/**
 * Pipeline detail page. Loads pipeline with steps, agent registry, and agent configs for step assignment.
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

  const configsByAgentKey = await getAgentConfigsByAgentKeys(
    agents.map((a) => ({ agentId: a.agentId, agentVersion: a.agentVersion })),
  );

  return (
    <PipelineDetailContent
      pipeline={pipeline}
      agents={agents}
      configsByAgentKey={configsByAgentKey}
    />
  );
};

export default withAuthProtection(PipelineDetailPage);
