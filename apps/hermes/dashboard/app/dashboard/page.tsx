import { PageHeader } from "@/components/page-header";
import { requireDashboardAdmin } from "@/lib/require-dashboard-admin";

/**
 * Main dashboard page. Placeholder; use the sidebar to navigate to Pipelines.
 */
const DashboardPage = async () => {
  await requireDashboardAdmin();

  return (
    <PageHeader
      title="Dashboard"
      description="Use the sidebar to manage pipelines and agents."
    />
  );
};

export default DashboardPage;
