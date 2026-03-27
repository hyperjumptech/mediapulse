import { notFound } from "next/navigation";

import { withAuthProtection } from "@/components/with-auth-protection";
import { getAgentConfigsByAgentKeys } from "@/lib/agent-configs";
import { getPipelineExecutionsPage } from "@/lib/pipeline-executions";
import { getAgentRegistryList, getPipelineWithSteps } from "@/lib/pipelines";
import {
  loadExpansionNameById,
  loadExpansionPickerPage,
  loadVariablePickerPage,
} from "@/lib/variable-expansion-picker-actions";
import {
  collectDataSourceExpansionTemplateIdsFromPipelineSteps,
  getExpansionDisplayNamesForPipeline,
} from "@/lib/pipeline-expansion-display-names";
import { validatePipeline } from "@/lib/validate-pipeline";
import { prisma as orchestrationPrisma } from "@hermes/orchestration-database";

import { PipelineDetailContent } from "./pipeline-detail-content";

const DEFAULT_PAGE_SIZE = 15;

/**
 * Pipeline detail page. Loads pipeline with steps, agent registry, validation, and agent configs for step assignment and step input/config editing.
 */
const PipelineDetailPage = async ({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams:
    | Promise<{ page?: string; size?: string }>
    | { page?: string; size?: string };
}) => {
  const { id } = await params;
  const resolved = await Promise.resolve(searchParams);
  const page = Math.max(1, parseInt(resolved.page ?? "1", 10) || 1);
  const pageSize = Math.min(
    100,
    Math.max(
      1,
      parseInt(resolved.size ?? String(DEFAULT_PAGE_SIZE), 10) ||
        DEFAULT_PAGE_SIZE,
    ),
  );
  const loaded = await getPipelineWithSteps(id);

  if (!loaded) {
    notFound();
  }

  const pipeline = loaded;

  const domainIntegration =
    await orchestrationPrisma.domainIntegration.findUnique({
      where: { id: pipeline.domainIntegrationId },
      select: { key: true },
    });
  const domainIntegrationKey = domainIntegration?.key ?? "";

  const expansionTemplateIds =
    collectDataSourceExpansionTemplateIdsFromPipelineSteps(pipeline.steps);
  const pipelineExpansionNames = await getExpansionDisplayNamesForPipeline(
    pipeline.domainIntegrationId,
    expansionTemplateIds,
  );

  const agents = await getAgentRegistryList(
    orchestrationPrisma,
    pipeline.domainIntegrationId,
  );

  const [configsByAgentKey, validation, executions] = await Promise.all([
    getAgentConfigsByAgentKeys(
      agents.map((a) => ({
        agentId: a.agentId,
        agentVersion: a.agentVersion,
      })),
    ),
    validatePipeline(pipeline, orchestrationPrisma),
    getPipelineExecutionsPage(id, page, pageSize),
  ]);

  return (
    <PipelineDetailContent
      pipeline={pipeline}
      domainIntegrationKey={domainIntegrationKey}
      agents={agents}
      configsByAgentKey={configsByAgentKey}
      pipelineValidation={validation}
      executions={executions.executions}
      totalExecutions={executions.total}
      currentPage={executions.page}
      pageSize={executions.pageSize}
      loadVariablePickerPage={loadVariablePickerPage}
      loadExpansionPickerPage={loadExpansionPickerPage}
      loadExpansionNameById={loadExpansionNameById}
      pipelineExpansionNames={pipelineExpansionNames}
    />
  );
};

export default withAuthProtection(PipelineDetailPage);
