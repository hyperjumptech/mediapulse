import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { DashboardShell } from "@/components/dashboard-shell";
import { DateTimeProvider } from "@/components/date-time/date-time-provider";
import {
  getDashboardSession,
  HERMES_DASHBOARD_CLEAR_SESSION_PATH,
} from "@/lib/auth-dashboard";
import type { DomainIntegrationNav } from "@/lib/dashboard-routes";
import { getViewerDateTimeContext } from "@/lib/date-time/viewer-date-time";
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
  const { timeZone, renderedAt } = await getViewerDateTimeContext();
  const domainIntegrations = loadDomainIntegrationNav();

  return (
    <DateTimeProvider timeZone={timeZone} renderedAt={renderedAt}>
      <DashboardShell
        user={user}
        defaultOpen={defaultOpen}
        domainIntegrations={domainIntegrations}
      >
        {children}
      </DashboardShell>
    </DateTimeProvider>
  );
}
