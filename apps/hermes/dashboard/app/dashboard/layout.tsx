import { DashboardShell } from "@/components/dashboard-shell";
import { getDashboardSession } from "@/lib/auth-dashboard";
import type { DashboardPage } from "@hermes/domain-contract";

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
  let domainPages: DashboardPage[] = [];
  try {
    const { getDefaultDomainIntegration } =
      await import("@/lib/domain-integrations");
    const integration = await getDefaultDomainIntegration();
    domainPages = integration.dashboard.pages;
  } catch {
    domainPages = [];
  }
  return (
    <DashboardShell user={user} domainPages={domainPages}>
      {children}
    </DashboardShell>
  );
}
