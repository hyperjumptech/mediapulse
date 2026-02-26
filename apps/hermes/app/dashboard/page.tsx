import { withAuthProtection } from "@/components/with-auth-protection";

/**
 * Main dashboard page. Placeholder; use the sidebar to navigate to Pipelines.
 */
const DashboardPage = () => {
  return (
    <div className="flex flex-col gap-2">
      <h1 className="text-2xl font-semibold text-foreground">Dashboard</h1>
      <p className="text-muted-foreground">
        Use the sidebar to manage pipelines and agents.
      </p>
    </div>
  );
};

export default withAuthProtection(DashboardPage);
