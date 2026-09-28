import { redirect } from "next/navigation";

import {
  DashboardShell,
  type DomainIntegrationNav,
} from "@/components/dashboard-shell";
import {
  getDashboardSession,
  HERMES_DASHBOARD_CLEAR_SESSION_PATH,
} from "@/lib/auth-dashboard";
import { getActiveDomainIntegrations } from "@/lib/domain-integrations";
import { mergeDomainIntegrationNavViews } from "@/lib/merge-domain-integration-nav-pages";
import { getDashboardAdmin } from "@/lib/require-dashboard-admin";

const loadDomainIntegrationNav = async (): Promise<DomainIntegrationNav[]> => {
  const admin = await getDashboardAdmin();
  if (!admin) {
    return [];
  }

  try {
    const integrations = await getActiveDomainIntegrations();

    return integrations.map((integration) => ({
      integrationId: integration.integrationId,
      name: integration.name,
      views: mergeDomainIntegrationNavViews(integration),
    }));
  } catch {
    return [];
  }
};

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getDashboardSession();
  if (!user) {
    redirect(HERMES_DASHBOARD_CLEAR_SESSION_PATH);
  }

  return (
    <DashboardShell user={user} domainIntegrations={loadDomainIntegrationNav()}>
      {children}
    </DashboardShell>
  );
}
