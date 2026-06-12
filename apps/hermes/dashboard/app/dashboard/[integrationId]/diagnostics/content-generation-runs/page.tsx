import { notFound } from "next/navigation";

import { withAuthProtection } from "@/components/with-auth-protection";
import { getDomainIntegrationByIntegrationId } from "@/lib/domain-integrations";
import { loadHermesDashboardExtensions } from "@/lib/load-hermes-dashboard-extensions";
import { integrationSupportsOperatorDiagnostics } from "@/lib/operator-diagnostics-capabilities";

/**
 * Integration-scoped operator CGA diagnostics list page (extension-provided).
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
  const extensions = await loadHermesDashboardExtensions();
  if (
    !integration ||
    !extensions ||
    !integrationSupportsOperatorDiagnostics(integration.capabilities)
  ) {
    notFound();
  }

  const { ContentGenerationRunsPageView } = extensions;
  const config = extensions.getRuntimeConfig();

  return (
    <ContentGenerationRunsPageView
      integrationId={integrationId}
      config={config}
      searchParams={searchParams}
    />
  );
};

export default withAuthProtection(IntegrationContentGenerationRunsPage);
