import { PageHeader } from "@/components/page-header";
import { requireDashboardAdmin } from "@/lib/require-dashboard-admin";

import { CreateDomainIntegrationForm } from "./create-domain-integration-form";

/**
 * Wizard page: create a pending domain integration and show the generated API key once.
 */
const CreateDomainIntegrationPage = async () => {
  await requireDashboardAdmin();

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="New domain integration"
        description="By creating an integration, Hermes will generate an API key for you. Use that key to register your system with Hermes."
      />
      <CreateDomainIntegrationForm />
    </div>
  );
};

export default CreateDomainIntegrationPage;
