import { withAuthProtection } from "@/components/with-auth-protection";

import { DataSourceExpansionForm } from "../data-source-expansion-form";

/**
 * Create data source expansion page. Renders form with empty defaults.
 */
const NewDataSourceExpansionPage = () => {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold text-foreground">
        New data source expansion
      </h1>
      <DataSourceExpansionForm mode="create" />
    </div>
  );
};

export default withAuthProtection(NewDataSourceExpansionPage);
