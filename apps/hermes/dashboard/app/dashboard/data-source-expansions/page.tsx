import { DomainTablePage } from "@/app/dashboard/domain-table-page";
import { withAuthProtection } from "@/components/with-auth-protection";

/**
 * Renders the domain-backed data-source-expansions page via shared table-v1.
 */
const DataSourceExpansionsPage = async ({
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
    <DomainTablePage
      resource="data-source-expansions"
      searchParams={searchParams}
    />
  );
};

export default withAuthProtection(DataSourceExpansionsPage);
