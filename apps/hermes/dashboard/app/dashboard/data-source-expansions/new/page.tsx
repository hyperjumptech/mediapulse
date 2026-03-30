import { redirect } from "next/navigation";
import { withAuthProtection } from "@/components/with-auth-protection";

/**
 * Legacy bookmark redirect: `/dashboard/data-source-expansions/new` → keyed full-page create URL.
 */
const NewDataSourceExpansionPage = async () => {
  const { getDefaultDomainIntegration } =
    await import("@/lib/domain-integrations");
  const integration = await getDefaultDomainIntegration();
  redirect(
    `/dashboard/${integration.integrationId}/data-source-expansions/new`,
  );
};

export default withAuthProtection(NewDataSourceExpansionPage);
