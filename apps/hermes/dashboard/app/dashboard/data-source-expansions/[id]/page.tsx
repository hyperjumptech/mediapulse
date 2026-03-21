import { redirect } from "next/navigation";
import { withAuthProtection } from "@/components/with-auth-protection";

/**
 * Legacy bookmark redirect: `/dashboard/data-source-expansions/[id]` → keyed table with row filter query.
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
    `/dashboard/${integration.key}/data-source-expansions?id=${encodeURIComponent(id)}`,
  );
};

export default withAuthProtection(EditDataSourceExpansionPage);
