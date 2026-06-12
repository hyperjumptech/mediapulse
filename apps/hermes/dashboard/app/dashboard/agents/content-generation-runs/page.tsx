import { redirect } from "next/navigation";

import { getDefaultDomainIntegration } from "@/lib/domain-integrations";
import { CGA_DIAGNOSTICS_PATH_SEGMENT } from "@mediapulse/hermes-dashboard";

/**
 * Legacy route redirect to integration-scoped CGA diagnostics.
 */
const LegacyContentGenerationRunsRedirectPage = async () => {
  const integration = await getDefaultDomainIntegration();
  if (!integration) {
    redirect("/dashboard");
  }
  redirect(
    `/dashboard/${integration.integrationId}/${CGA_DIAGNOSTICS_PATH_SEGMENT}`,
  );
};

export default LegacyContentGenerationRunsRedirectPage;
