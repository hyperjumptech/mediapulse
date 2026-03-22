import type { DashboardPage } from "@hermes/domain-contract";
import { redirect } from "next/navigation";

import { DashboardShell } from "@/components/dashboard-shell";
import {
  getDashboardSession,
  HERMES_DASHBOARD_CLEAR_SESSION_PATH,
  resolveHermesActiveAdminDashboardAccess,
} from "@/lib/auth-dashboard";
import { getActiveDomainIntegrations } from "@/lib/domain-integrations";

/**
 * Dashboard layout: sidebar, header with breadcrumb, and main content area.
 * User name/email and logout live in the sidebar footer. Cookie presence is enforced per-page via withAuthProtection;
 * this layout additionally requires an active ADMIN user in the database.
 */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const access = await resolveHermesActiveAdminDashboardAccess();
  if (!access.ok) {
    redirect(HERMES_DASHBOARD_CLEAR_SESSION_PATH);
  }

  const user = await getDashboardSession();
  let domainIntegrations: Array<{
    key: string;
    name: string;
    pages: DashboardPage[];
  }> = [];
  try {
    const integrations = await getActiveDomainIntegrations();
    domainIntegrations = integrations.map((i) => ({
      key: i.key,
      name: i.name,
      pages: i.dashboard.pages,
    }));
  } catch {
    domainIntegrations = [];
  }
  return (
    <DashboardShell user={user} domainIntegrations={domainIntegrations}>
      {children}
    </DashboardShell>
  );
}
