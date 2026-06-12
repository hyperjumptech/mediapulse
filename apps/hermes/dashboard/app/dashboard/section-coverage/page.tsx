import { redirect } from "next/navigation";
import { SECTION_COVERAGE_PATH_SEGMENT } from "@hermes/dashboard-extensions";

import { getDefaultDomainIntegration } from "@/lib/domain-integrations";

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
