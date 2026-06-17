import { notFound } from "next/navigation";

import { DomainContentView } from "@/components/domain-content-view";
import { withAuthProtection } from "@/components/with-auth-protection";
import { fetchDomainContentView } from "@/lib/domain-content-view";
import { getDomainIntegrationByIntegrationId } from "@/lib/domain-integrations";

/**
 * Renders a sidebar markdown, html, or text view from the domain manifest.
 */
const DomainContentViewPage = async ({
  params,
}: {
  params: Promise<{ integrationId: string; resource: string }>;
}) => {
  const { integrationId, resource } = await params;
  const integration = await getDomainIntegrationByIntegrationId(integrationId);
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
  });

  return (
    <DomainContentView
      kind={view.kind}
      body={content.body}
      title={content.title ?? view.label}
    />
  );
};

export default withAuthProtection(DomainContentViewPage);
