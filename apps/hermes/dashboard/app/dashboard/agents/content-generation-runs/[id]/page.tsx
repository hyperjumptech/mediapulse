import { redirect } from "next/navigation";
import { CGA_DIAGNOSTICS_PATH_SEGMENT } from "@hermes/dashboard-extensions";

import { getDefaultDomainIntegration } from "@/lib/domain-integrations";

/**
 * Legacy route redirect to integration-scoped CGA run detail.
 */
const LegacyContentGenerationRunDetailRedirectPage = async ({
  params,
}: {
  params: Promise<{ id: string }>;
}) => {
  const { id } = await params;
  const integration = await getDefaultDomainIntegration();
  if (!integration) {
    redirect("/dashboard");
  }
  redirect(
    `/dashboard/${integration.integrationId}/${CGA_DIAGNOSTICS_PATH_SEGMENT}/${id}`,
  );
};

export default LegacyContentGenerationRunDetailRedirectPage;
