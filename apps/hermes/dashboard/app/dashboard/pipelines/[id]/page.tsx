import { notFound } from "next/navigation";
import { Suspense } from "react";

import { SectionSkeleton } from "@/components/page-skeletons";
import { getAgentConfigsByAgentKeys } from "@/lib/agent-configs";
import { getAllAgentContracts } from "@/lib/agent-contracts";
import {
  parseListPagination,
  type ListPageSearchParams,
} from "@/lib/list-page-params";
import { includedPipelineStepLabels } from "@/lib/check-pipeline-steps-composition";
import {
  getAgentRegistryList,
  getComposablePipelineOptions,
  getPipelineWithSteps,
} from "@/lib/pipelines";
import { getPipelineExecutionsPage } from "@/lib/pipeline-executions";
import { withDashboardAdmin } from "@/lib/require-dashboard-admin";
import {
  loadExpansionPickerPage,
  loadVariablePickerPage,
} from "@/lib/variable-expansion-picker-actions";
import { getPipelineRunParamKeys } from "@/lib/pipeline-run-param-keys";
import { validatePipeline } from "@/lib/validate-pipeline";
import { prisma as orchestrationPrisma } from "@hermes/orchestration-database";

import { PipelineDetailContent } from "./pipeline-detail-content";
import { PipelineExecutionsSection } from "./pipeline-executions-section";

type PipelineDetailSearchParams = Pick<ListPageSearchParams, "page" | "size">;

const PipelineDetailPage = async ({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams:
    | Promise<PipelineDetailSearchParams>
    | PipelineDetailSearchParams;
}) => {
  const { id } = await params;
  const resolved = await Promise.resolve(searchParams);
  const { page, pageSize } = parseListPagination(resolved);
  const executionsPage = getPipelineExecutionsPage(id, page, pageSize);
  void executionsPage.catch(() => undefined);
  const [pipeline, allContracts, domainIntegrations] = await withDashboardAdmin(
    Promise.all([
      getPipelineWithSteps(id),
      getAllAgentContracts(),
      orchestrationPrisma.domainIntegration.findMany({
        orderBy: [{ isDefault: "desc" }, { integrationId: "asc" }],
        select: { id: true, integrationId: true, name: true },
      }),
    ]),
  );

  if (!pipeline) {
    notFound();
  }

  const [
    agents,
    validation,
    runParamKeys,
    composablePipelines,
    includedStepLabelsByStepId,
  ] = await Promise.all([
    getAgentRegistryList(orchestrationPrisma, pipeline.domainIntegrationId),
    validatePipeline(pipeline, orchestrationPrisma),
    getPipelineRunParamKeys(pipeline.id, orchestrationPrisma),
    getComposablePipelineOptions(pipeline, orchestrationPrisma),
    includedPipelineStepLabels({
      db: orchestrationPrisma,
      pipelineId: pipeline.id,
    }),
  ]);
  const agentKeys = agents.map((agent) => ({
    agentId: agent.agentId,
    agentVersion: agent.agentVersion,
  }));
  const configsByAgentKey = await getAgentConfigsByAgentKeys(agentKeys);

  return (
    <PipelineDetailContent
      pipeline={pipeline}
      agents={agents}
      domainIntegrations={domainIntegrations}
      configsByAgentKey={configsByAgentKey}
      allContracts={allContracts}
      pipelineValidation={validation}
      runParamKeys={runParamKeys}
      composablePipelines={composablePipelines}
      includedStepLabelsByStepId={includedStepLabelsByStepId}
      executionsSection={
        <Suspense key={`${page}:${pageSize}`} fallback={<SectionSkeleton />}>
          <PipelineExecutionsSection
            pipelineId={pipeline.id}
            page={page}
            pageSize={pageSize}
            executionsPage={executionsPage}
          />
        </Suspense>
      }
      loadVariablePickerPage={loadVariablePickerPage}
      loadExpansionPickerPage={loadExpansionPickerPage}
    />
  );
};

export default PipelineDetailPage;
