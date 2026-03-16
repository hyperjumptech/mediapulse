import { PageHeader } from "@/components/page-header";
import { withAuthProtection } from "@/components/with-auth-protection";

/**
 * Main dashboard page. Placeholder; use the sidebar to navigate to Pipelines.
 */
const DashboardPage = () => {
  return (
    <PageHeader
      title="Dashboard"
      description="Use the sidebar to manage pipelines and agents."
    />
  );
};

export default withAuthProtection(DashboardPage);
