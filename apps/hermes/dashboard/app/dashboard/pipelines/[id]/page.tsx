import { notFound } from "next/navigation";

import { withAuthProtection } from "@/components/with-auth-protection";
import { getAgentConfigsByAgentKeys } from "@/lib/agent-configs";
import { getAllAgentContracts } from "@/lib/agent-contracts";
import { getPipelineExecutionsPage } from "@/lib/pipeline-executions";
import { getAgentRegistryList, getPipelineWithSteps } from "@/lib/pipelines";
import {
  loadExpansionPickerPage,
  loadVariablePickerPage,
} from "@/lib/variable-expansion-picker-actions";
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

  const [agents, domainIntegrations] = await Promise.all([
    getAgentRegistryList(orchestrationPrisma, pipeline.domainIntegrationId),
    orchestrationPrisma.domainIntegration.findMany({
      orderBy: [{ isDefault: "desc" }, { integrationId: "asc" }],
      select: { id: true, integrationId: true, name: true },
    }),
  ]);

  const [configsByAgentKey, allContracts, validation, executions] =
    await Promise.all([
      getAgentConfigsByAgentKeys(
        agents.map((a) => ({
          agentId: a.agentId,
          agentVersion: a.agentVersion,
        })),
      ),
      getAllAgentContracts(),
      validatePipeline(pipeline, orchestrationPrisma),
      getPipelineExecutionsPage(id, page, pageSize),
    ]);

  return (
    <PipelineDetailContent
      pipeline={pipeline}
      agents={agents}
      domainIntegrations={domainIntegrations}
      configsByAgentKey={configsByAgentKey}
      allContracts={allContracts}
      pipelineValidation={validation}
      executions={executions.executions}
      totalExecutions={executions.total}
      currentPage={executions.page}
      pageSize={executions.pageSize}
      loadVariablePickerPage={loadVariablePickerPage}
      loadExpansionPickerPage={loadExpansionPickerPage}
    />
  );
};

export default withAuthProtection(PipelineDetailPage);
