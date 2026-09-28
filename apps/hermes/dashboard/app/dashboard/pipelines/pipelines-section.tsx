import { prisma, type Prisma } from "@hermes/orchestration-database";

import { getPipelineSummariesWithValidation } from "@/lib/pipeline-summaries";
import { withDashboardAdmin } from "@/lib/require-dashboard-admin";

import { PipelinesWithModal } from "./pipelines-with-modal";

const domainIntegrationOptionsFindManyArgs = {
  orderBy: [{ isDefault: "desc" }, { integrationId: "asc" }],
  select: { id: true, integrationId: true, name: true },
} satisfies Prisma.DomainIntegrationFindManyArgs;

export const PipelinesSection = async () => {
  const [{ pipelines, pipelineValidationById }, domainIntegrations] =
    await withDashboardAdmin(
      Promise.all([
        getPipelineSummariesWithValidation(),
        prisma.domainIntegration.findMany(domainIntegrationOptionsFindManyArgs),
      ]),
    );

  return (
    <PipelinesWithModal
      pipelines={pipelines}
      pipelineValidationById={pipelineValidationById}
      domainIntegrations={domainIntegrations}
    />
  );
};
