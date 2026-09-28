import { prisma } from "@hermes/orchestration-database";

import { getPipelinesWithSteps } from "@/lib/pipelines";
import { withDashboardAdmin } from "@/lib/require-dashboard-admin";
import { getPipelinesValidationMap } from "@/lib/validate-pipeline";

import { PipelinesWithModal } from "./pipelines-with-modal";

export const PipelinesSection = async () => {
  const pipelines = await withDashboardAdmin(getPipelinesWithSteps());
  const [pipelineValidationById, domainIntegrations] = await Promise.all([
    getPipelinesValidationMap(pipelines, prisma),
    prisma.domainIntegration.findMany({
      orderBy: [{ isDefault: "desc" }, { integrationId: "asc" }],
      select: { id: true, integrationId: true, name: true },
    }),
  ]);

  return (
    <PipelinesWithModal
      pipelines={pipelines}
      pipelineValidationById={pipelineValidationById}
      domainIntegrations={domainIntegrations}
    />
  );
};
