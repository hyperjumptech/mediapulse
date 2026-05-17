import { PageHeader } from "@/components/page-header";
import { withAuthProtection } from "@/components/with-auth-protection";
import { getPipelinesWithSteps } from "@/lib/pipelines";
import { getPipelinesValidationMap } from "@/lib/validate-pipeline";
import { prisma } from "@hermes/orchestration-database";

import { PipelinesWithModal } from "./pipelines-with-modal";

/**
 * Pipelines list page. Fetches all pipelines and validation, renders table with create/edit modals.
 */
const PipelinesPage = async () => {
  const pipelines = await getPipelinesWithSteps();
  const [pipelineValidationById, domainIntegrations] = await Promise.all([
    getPipelinesValidationMap(pipelines, prisma),
    prisma.domainIntegration.findMany({
      orderBy: [{ isDefault: "desc" }, { integrationId: "asc" }],
      select: { id: true, integrationId: true, name: true },
    }),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Pipelines"
        description="Create and manage pipelines and their steps."
      />
      <PipelinesWithModal
        pipelines={pipelines}
        pipelineValidationById={pipelineValidationById}
        domainIntegrations={domainIntegrations}
      />
    </div>
  );
};

export default withAuthProtection(PipelinesPage);
