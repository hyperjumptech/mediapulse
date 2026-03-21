import { redirect } from "next/navigation";
import { withAuthProtection } from "@/components/with-auth-protection";

/**
 * Create data source expansion page. Renders form with empty defaults.
 */
const NewDataSourceExpansionPage = () => {
  redirect("/dashboard/data-source-expansions");
};

export default withAuthProtection(NewDataSourceExpansionPage);
