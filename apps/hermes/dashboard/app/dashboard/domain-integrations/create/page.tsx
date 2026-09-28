import { requireDashboardAdmin } from "@/lib/require-dashboard-admin";

import { CreateDomainIntegrationForm } from "./create-domain-integration-form";

const CreateDomainIntegrationPage = async () => {
  await requireDashboardAdmin();

  return (
    <div className="flex flex-col gap-4">
      <CreateDomainIntegrationForm />
    </div>
  );
};

export default CreateDomainIntegrationPage;
