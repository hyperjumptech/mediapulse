import { notFound } from "next/navigation";

import { withAuthProtection } from "@/components/with-auth-protection";
import { getDomainIntegrationByIntegrationId } from "@/lib/domain-integrations";
import { loadHermesDashboardExtensions } from "@/lib/load-hermes-dashboard-extensions";
import { integrationSupportsOperatorDiagnostics } from "@/lib/operator-diagnostics-capabilities";

/**
 * Integration-scoped operator CGA diagnostics detail page (extension-provided).
 */
const IntegrationContentGenerationRunDetailPage = async ({
  params,
}: {
  params: Promise<{ integrationId: string; id: string }>;
}) => {
  const { integrationId, id } = await params;
  const integration = await getDomainIntegrationByIntegrationId(integrationId);
  const extensions = await loadHermesDashboardExtensions();
  if (
    !integration ||
    !extensions ||
    !integrationSupportsOperatorDiagnostics(integration.capabilities)
  ) {
    notFound();
  }

  const { ContentGenerationRunDetailPageView } = extensions;
  const config = extensions.getRuntimeConfig();

  return <ContentGenerationRunDetailPageView runId={id} config={config} />;
};

export default withAuthProtection(IntegrationContentGenerationRunDetailPage);
