import { DashboardShell } from "@/components/dashboard-shell";
import { getDashboardSession } from "@/lib/auth-dashboard";

/**
 * Dashboard layout: sidebar, header with breadcrumb, and main content area.
 * User name/email and logout live in the sidebar footer. Auth is enforced per-page via withAuthProtection.
 */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getDashboardSession();
  return <DashboardShell user={user}>{children}</DashboardShell>;
}
