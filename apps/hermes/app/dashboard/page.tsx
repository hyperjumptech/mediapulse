import { withAuthProtection } from "@/components/with-auth-protection";

const DashboardPage = () => {
  return (
    <div className="min-h-svh flex items-center justify-center">
      Admin Dashboard
    </div>
  );
};

export default withAuthProtection(DashboardPage);
