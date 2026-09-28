import { notFound } from "next/navigation";

import { DomainContentView } from "@/components/domain-content-view";
import { fetchDomainContentView } from "@/lib/domain-content-view";
import { getDomainIntegrationByIntegrationId } from "@/lib/domain-integrations";
import { withDashboardAdmin } from "@/lib/require-dashboard-admin";

/**
 * Renders a sidebar markdown, html, or text view from the domain manifest.
 */
const DomainContentViewPage = async ({
  params,
}: {
  params: Promise<{ integrationId: string; resource: string }>;
}) => {
  const { integrationId, resource } = await params;
  const integration = await withDashboardAdmin(
    getDomainIntegrationByIntegrationId(integrationId),
  );
  if (!integration) {
    notFound();
  }

  const view = integration.dashboard.views.find(
    (entry) =>
      entry.placement === "sidebar" &&
      entry.pathSegment === resource &&
      (entry.kind === "markdown" ||
        entry.kind === "html" ||
        entry.kind === "text"),
  );

  if (!view || view.kind === "resource-table") {
    notFound();
  }

  const content = await fetchDomainContentView({
    integrationId,
    view,
    integration,
  });

  return (
    <DomainContentView
      kind={view.kind}
      body={content.body}
      title={content.title ?? view.label}
    />
  );
};

export default DomainContentViewPage;
