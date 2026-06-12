import { notFound } from "next/navigation";
import { SectionCoveragePageView } from "@mediapulse/hermes-dashboard";

import { withAuthProtection } from "@/components/with-auth-protection";
import { getDomainIntegrationByIntegrationId } from "@/lib/domain-integrations";
import { getMediapulseHermesDashboardRuntimeConfig } from "@/lib/mediapulse-hermes-dashboard-config";
import { integrationSupportsOperatorDiagnostics } from "@/lib/operator-diagnostics-capabilities";

/**
 * Integration-scoped section coverage diagnostics page.
 */
const IntegrationSectionCoveragePage = async ({
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
    <SectionCoveragePageView
      config={getMediapulseHermesDashboardRuntimeConfig()}
      searchParams={searchParams}
    />
  );
};

export default withAuthProtection(IntegrationSectionCoveragePage);
