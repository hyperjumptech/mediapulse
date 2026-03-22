import { notFound } from "next/navigation";

import { withAuthProtection } from "@/components/with-auth-protection";
import { getAgentConfigsByAgentKeys } from "@/lib/agent-configs";
import { getAgentRegistryList, getPipelineWithSteps } from "@/lib/pipelines";
import {
  loadExpansionPickerPage,
  loadVariablePickerPage,
} from "@/lib/variable-expansion-picker-actions";
import { validatePipeline } from "@/lib/validate-pipeline";
import { prisma as orchestrationPrisma } from "@hermes/orchestration-database";

import { PipelineDetailContent } from "./pipeline-detail-content";

/**
 * Pipeline detail page. Loads pipeline with steps, agent registry, validation, and agent configs for step assignment and step input/config editing.
 */
const PipelineDetailPage = async ({
  params,
}: {
  params: Promise<{ id: string }>;
}) => {
  const { id } = await params;
  const loaded = await getPipelineWithSteps(id);

  if (!loaded) {
    notFound();
  }

  const pipeline = loaded;

  const agents = await getAgentRegistryList(
    orchestrationPrisma,
    pipeline.domainIntegrationId,
  );

  const [configsByAgentKey, validation] = await Promise.all([
    getAgentConfigsByAgentKeys(
      agents.map((a) => ({
        agentId: a.agentId,
        agentVersion: a.agentVersion,
      })),
    ),
    validatePipeline(pipeline, orchestrationPrisma),
  ]);

  return (
    <PipelineDetailContent
      pipeline={pipeline}
      agents={agents}
      configsByAgentKey={configsByAgentKey}
      pipelineValidation={validation}
      loadVariablePickerPage={loadVariablePickerPage}
      loadExpansionPickerPage={loadExpansionPickerPage}
    />
  );
};

export default withAuthProtection(PipelineDetailPage);
