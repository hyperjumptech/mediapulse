import { notFound } from "next/navigation";

import { withAuthProtection } from "@/components/with-auth-protection";
import { getDomainIntegrationByIntegrationId } from "@/lib/domain-integrations";
import { loadHermesDashboardExtensions } from "@/lib/load-hermes-dashboard-extensions";
import { integrationSupportsOperatorDiagnostics } from "@/lib/operator-diagnostics-capabilities";

/**
 * Integration-scoped operator section coverage page (extension-provided).
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
  const extensions = await loadHermesDashboardExtensions();
  if (
    !integration ||
    !extensions ||
    !integrationSupportsOperatorDiagnostics(integration.capabilities)
  ) {
    notFound();
  }

  const { SectionCoveragePageView } = extensions;
  const config = extensions.getRuntimeConfig();

  return (
    <SectionCoveragePageView config={config} searchParams={searchParams} />
  );
};

export default withAuthProtection(IntegrationSectionCoveragePage);
