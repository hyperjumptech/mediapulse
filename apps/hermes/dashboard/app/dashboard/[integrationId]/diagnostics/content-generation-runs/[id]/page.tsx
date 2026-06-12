import { notFound } from "next/navigation";
import { ContentGenerationRunDetailPageView } from "@mediapulse/hermes-dashboard";

import { withAuthProtection } from "@/components/with-auth-protection";
import { getDomainIntegrationByIntegrationId } from "@/lib/domain-integrations";
import { getMediapulseHermesDashboardRuntimeConfig } from "@/lib/mediapulse-hermes-dashboard-config";
import { integrationSupportsOperatorDiagnostics } from "@/lib/operator-diagnostics-capabilities";

/**
 * Integration-scoped CGA diagnostics detail page.
 */
const IntegrationContentGenerationRunDetailPage = async ({
  params,
}: {
  params: Promise<{ integrationId: string; id: string }>;
}) => {
  const { integrationId, id } = await params;
  const integration = await getDomainIntegrationByIntegrationId(integrationId);
  if (
    !integration ||
    !integrationSupportsOperatorDiagnostics(integration.capabilities)
  ) {
    notFound();
  }

  return (
    <ContentGenerationRunDetailPageView
      runId={id}
      config={getMediapulseHermesDashboardRuntimeConfig()}
    />
  );
};

export default withAuthProtection(IntegrationContentGenerationRunDetailPage);
