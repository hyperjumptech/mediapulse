import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { CommandPalette } from "@/components/command-palette";
import { DashboardShell } from "@/components/dashboard-shell";
import {
  getDashboardSession,
  HERMES_DASHBOARD_CLEAR_SESSION_PATH,
} from "@/lib/auth-dashboard";
import type { DomainIntegrationNav } from "@/lib/dashboard-routes";
import { getActiveDomainIntegrationsCached } from "@/lib/domain-integrations";
import { mergeDomainIntegrationNavViews } from "@/lib/merge-domain-integration-nav-pages";
import { getDashboardAdmin } from "@/lib/require-dashboard-admin";

const SIDEBAR_STATE_COOKIE_NAME = "sidebar_state";

const loadDomainIntegrationNav = async (): Promise<DomainIntegrationNav[]> => {
  const admin = await getDashboardAdmin();
  if (!admin) {
    return [];
  }

  try {
    const integrations = await getActiveDomainIntegrationsCached();

    return integrations.map((integration) => ({
      integrationId: integration.integrationId,
      name: integration.name,
      views: mergeDomainIntegrationNavViews(integration),
    }));
  } catch {
    return [];
  }
};

const readSidebarDefaultOpen = async (): Promise<boolean> => {
  const cookieStore = await cookies();
  const sidebarState = cookieStore.get(SIDEBAR_STATE_COOKIE_NAME)?.value;

  return sidebarState !== "false";
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

  const defaultOpen = await readSidebarDefaultOpen();
  const domainIntegrations = loadDomainIntegrationNav();

  return (
    <DashboardShell
      user={user}
      defaultOpen={defaultOpen}
      domainIntegrations={domainIntegrations}
      headerActions={<CommandPalette domainIntegrations={domainIntegrations} />}
    >
      {children}
    </DashboardShell>
  );
}
