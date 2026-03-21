import type { DashboardPage } from "@hermes/domain-contract";

import { DashboardShell } from "@/components/dashboard-shell";
import { getDashboardSession } from "@/lib/auth-dashboard";
import { getActiveDomainIntegrations } from "@/lib/domain-integrations";

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
