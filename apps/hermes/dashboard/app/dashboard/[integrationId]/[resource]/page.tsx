import { notFound } from "next/navigation";

import { DomainTablePage } from "@/app/dashboard/domain-table-page";
import DomainContentViewPage from "@/app/dashboard/domain-content-view-page";
import { withAuthProtection } from "@/components/with-auth-protection";
import { getDomainIntegrationByIntegrationId } from "@/lib/domain-integrations";
import type { DomainTableSearchParams } from "@/lib/domain-table-list-params";
import { mergeDomainIntegrationNavViews } from "@/lib/merge-domain-integration-nav-pages";

/**
 * Domain integration dashboard view. Dispatches by manifest `kind` for sidebar views.
 */
const IntegrationDashboardViewPage = async ({
  params,
  searchParams,
}: {
  params: Promise<{ integrationId: string; resource: string }>;
  searchParams: Promise<DomainTableSearchParams> | DomainTableSearchParams;
}) => {
  const { integrationId, resource } = await params;
  const integration = await getDomainIntegrationByIntegrationId(integrationId);
  if (!integration) {
    notFound();
  }

  const view = mergeDomainIntegrationNavViews(integration).find(
    (entry) => entry.pathSegment === resource,
  );

  if (!view) {
    notFound();
  }

  if (view.kind === "resource-table") {
    return (
      <DomainTablePage
        integrationId={integrationId}
        resource={resource}
        searchParams={searchParams}
      />
    );
  }

  if (
    view.kind === "markdown" ||
    view.kind === "html" ||
    view.kind === "text"
  ) {
    return (
      <DomainContentViewPage
        params={Promise.resolve({ integrationId, resource })}
      />
    );
  }

  notFound();
};

export default withAuthProtection(IntegrationDashboardViewPage);
