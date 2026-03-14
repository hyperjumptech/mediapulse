import { withAuthProtection } from "@/components/with-auth-protection";
import { getPipelinesWithSteps } from "@/lib/pipelines";
import { getPipelinesValidationMap } from "@/lib/validate-pipeline";
import { prisma } from "@workspace/database";

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
    <PipelinesWithModal
      pipelines={pipelines}
      pipelineValidationById={pipelineValidationById}
    />
  );
};

export default withAuthProtection(PipelinesPage);
