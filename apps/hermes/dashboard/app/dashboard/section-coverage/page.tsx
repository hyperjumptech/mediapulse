import { redirect } from "next/navigation";

import { getDefaultDomainIntegration } from "@/lib/domain-integrations";
import { SECTION_COVERAGE_PATH_SEGMENT } from "@mediapulse/hermes-dashboard/diagnostics-nav";

/**
 * Legacy route redirect to integration-scoped section coverage diagnostics.
 */
const LegacySectionCoverageRedirectPage = async () => {
  const integration = await getDefaultDomainIntegration();
  if (!integration) {
    redirect("/dashboard");
  }
  redirect(
    `/dashboard/${integration.integrationId}/${SECTION_COVERAGE_PATH_SEGMENT}`,
  );
};

export default LegacySectionCoverageRedirectPage;
