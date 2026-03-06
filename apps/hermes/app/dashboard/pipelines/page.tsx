import { withAuthProtection } from "@/components/with-auth-protection";
import { getPipelinesWithSteps } from "@/lib/pipelines";

import { PipelinesWithModal } from "./pipelines-with-modal";

/**
 * Pipelines list page. Fetches all pipelines and renders table with create/edit modals.
 */
const PipelinesPage = async () => {
  const pipelines = await getPipelinesWithSteps();

  return <PipelinesWithModal pipelines={pipelines} />;
};

export default withAuthProtection(PipelinesPage);
