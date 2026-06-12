import { notFound } from "next/navigation";
import { ContentGenerationRunsPageView } from "@mediapulse/hermes-dashboard";

import { withAuthProtection } from "@/components/with-auth-protection";
import { getDomainIntegrationByIntegrationId } from "@/lib/domain-integrations";
import { getMediapulseHermesDashboardRuntimeConfig } from "@/lib/mediapulse-hermes-dashboard-config";
import { integrationSupportsOperatorDiagnostics } from "@/lib/operator-diagnostics-capabilities";

/**
 * Integration-scoped CGA diagnostics list page.
 */
const IntegrationContentGenerationRunsPage = async ({
  params,
  searchParams,
}: {
  params: Promise<{ integrationId: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) => {
  const { integrationId } = await params;
  const integration = await getDomainIntegrationByIntegrationId(integrationId);
  if (
    !integration ||
    !integrationSupportsOperatorDiagnostics(integration.capabilities)
  ) {
    notFound();
  }

  return (
    <ContentGenerationRunsPageView
      integrationId={integrationId}
      config={getMediapulseHermesDashboardRuntimeConfig()}
      searchParams={searchParams}
    />
  );
};

export default withAuthProtection(IntegrationContentGenerationRunsPage);
