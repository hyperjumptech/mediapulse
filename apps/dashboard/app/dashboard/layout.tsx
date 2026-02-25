import { ProtectedRoute } from "@/components/protected-route";
import DashboardPage from "./page";

export default function DashboardLayout() {
  return (
    <ProtectedRoute>
      <DashboardPage />
    </ProtectedRoute>
  );
}
