import { DomainTablePage } from "@/app/dashboard/domain-table-page";
import { withAuthProtection } from "@/components/with-auth-protection";

/**
 * Domain integration table-v1 page. URL: /dashboard/{integrationId}/{resource pathSegment}.
 */
const IntegrationDomainTablePage = async ({
  params,
  searchParams,
}: {
  params: Promise<{ integrationId: string; resource: string }>;
  searchParams:
    | Promise<{
        page?: string;
        size?: string;
        q?: string;
        sort?: string;
        dir?: string;
        tickerId?: string;
        from?: string;
        to?: string;
      }>
    | {
        page?: string;
        size?: string;
        q?: string;
        sort?: string;
        dir?: string;
        tickerId?: string;
        from?: string;
        to?: string;
      };
}) => {
  const { integrationId, resource } = await params;
  return (
    <DomainTablePage
      integrationId={integrationId}
      resource={resource}
      searchParams={searchParams}
    />
  );
};

export default withAuthProtection(IntegrationDomainTablePage);
