import { withAuthProtection } from "@/components/with-auth-protection";
import { DomainTablePage } from "@/app/dashboard/domain-table-page";

/**
 * Renders the domain-backed tickers page via the shared table-v1 template.
 */
const TickersPage = async ({
  searchParams,
}: {
  searchParams:
    | Promise<{
        page?: string;
        size?: string;
        q?: string;
        sort?: string;
        dir?: string;
      }>
    | { page?: string; size?: string; q?: string; sort?: string; dir?: string };
}) => {
  return <DomainTablePage resource="tickers" searchParams={searchParams} />;
};

export default withAuthProtection(TickersPage);
