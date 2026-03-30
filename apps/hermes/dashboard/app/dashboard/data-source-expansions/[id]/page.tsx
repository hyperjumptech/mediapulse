import { redirect } from "next/navigation";
import { withAuthProtection } from "@/components/with-auth-protection";

/**
 * Legacy bookmark redirect: `/dashboard/data-source-expansions/[id]` → keyed full-page edit URL.
 */
const EditDataSourceExpansionPage = async ({
  params,
}: {
  params: Promise<{ id: string }>;
}) => {
  const { id } = await params;
  const { getDefaultDomainIntegration } =
    await import("@/lib/domain-integrations");
  const integration = await getDefaultDomainIntegration();
  redirect(
    `/dashboard/${integration.integrationId}/data-source-expansions/${encodeURIComponent(id)}/edit`,
  );
};

export default withAuthProtection(EditDataSourceExpansionPage);
