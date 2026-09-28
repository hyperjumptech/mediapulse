import { redirect } from "next/navigation";
import { requireDashboardAdmin } from "@/lib/require-dashboard-admin";

/**
 * Legacy bookmark redirect: `/dashboard/data-source-expansions/[id]` → keyed full-page edit URL.
 */
const EditDataSourceExpansionPage = async ({
  params,
}: {
  params: Promise<{ id: string }>;
}) => {
  await requireDashboardAdmin();
  const { id } = await params;
  const { getDefaultDomainIntegration } =
    await import("@/lib/domain-integrations");
  const integration = await getDefaultDomainIntegration();
  redirect(
    `/dashboard/${integration.integrationId}/data-source-expansions/${encodeURIComponent(id)}/edit`,
  );
};

export default EditDataSourceExpansionPage;
