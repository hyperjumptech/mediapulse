import { redirect } from "next/navigation";
import { withAuthProtection } from "@/components/with-auth-protection";

/**
 * Edit data source expansion page. Loads expansion by id and renders form with initial values.
 */
const EditDataSourceExpansionPage = async ({
  params,
}: {
  params: Promise<{ id: string }>;
}) => {
  const { id } = await params;
  redirect(`/dashboard/data-source-expansions?id=${encodeURIComponent(id)}`);
};

export default withAuthProtection(EditDataSourceExpansionPage);
