import { withAuthProtection } from "@/components/with-auth-protection";
import { LogoutForm } from "./logout-form";

const DashboardPage = () => {
  return (
    <div className="relative min-h-svh flex items-center justify-center">
      <div className="absolute right-4 top-4">
        <LogoutForm />
      </div>
      Admin Dashboard
    </div>
  );
};

export default withAuthProtection(DashboardPage);
