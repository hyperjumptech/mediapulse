import { PageHeader } from "@/components/page-header";
import { withAuthProtection } from "@/components/with-auth-protection";
import { getPipelinesWithSteps } from "@/lib/pipelines";
import { getPipelinesValidationMap } from "@/lib/validate-pipeline";
import { prisma } from "@workspace/orchestration-database";

import { PipelinesWithModal } from "./pipelines-with-modal";

/**
 * Pipelines list page. Fetches all pipelines and validation, renders table with create/edit modals.
 */
const PipelinesPage = async () => {
  const pipelines = await getPipelinesWithSteps();
  const pipelineValidationById = await getPipelinesValidationMap(
    pipelines,
    prisma,
  );

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Pipelines"
        description="Create and manage pipelines and their steps."
      />
      <PipelinesWithModal
        pipelines={pipelines}
        pipelineValidationById={pipelineValidationById}
      />
    </div>
  );
};

export default withAuthProtection(PipelinesPage);
