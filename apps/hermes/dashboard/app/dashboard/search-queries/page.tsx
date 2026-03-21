import { DomainTablePage } from "@/app/dashboard/domain-table-page";
import { withAuthProtection } from "@/components/with-auth-protection";

/**
 * Renders the domain-backed search-queries page via the shared table-v1 template.
 */
const SearchQueriesPage = async ({
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
  return (
    <DomainTablePage resource="search-queries" searchParams={searchParams} />
  );
};

export default withAuthProtection(SearchQueriesPage);
