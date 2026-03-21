import { DomainTablePage } from "@/app/dashboard/domain-table-page";
import { withAuthProtection } from "@/components/with-auth-protection";

/**
 * Renders the domain-backed relation-types page via the shared table-v1 template.
 */
const RelationTypesPage = async ({
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
    <DomainTablePage resource="relation-types" searchParams={searchParams} />
  );
};

export default withAuthProtection(RelationTypesPage);
