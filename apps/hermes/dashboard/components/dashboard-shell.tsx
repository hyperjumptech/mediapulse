import type { ReactNode } from "react";

import { Separator } from "@workspace/ui/components/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@workspace/ui/components/sidebar";

import type { DomainIntegrationNav } from "@/lib/dashboard-routes";

import { AppSidebar } from "./app-sidebar";
import { BreadcrumbEntityLabelsProvider } from "./breadcrumb-entity-label";
import { DashboardBreadcrumbs } from "./dashboard-breadcrumbs";

export type DashboardUser = { name: string; email: string };

export type { DomainIntegrationNav };

type DashboardShellProps = {
  children: ReactNode;
  user?: DashboardUser | null;
  domainIntegrations: Promise<DomainIntegrationNav[]>;
  defaultOpen?: boolean;
  headerActions?: ReactNode;
};

export const DashboardShell = ({
  children,
  user,
  domainIntegrations,
  defaultOpen = true,
  headerActions,
}: DashboardShellProps) => {
  return (
    <SidebarProvider defaultOpen={defaultOpen}>
      <BreadcrumbEntityLabelsProvider>
        <AppSidebar
          user={user ?? null}
          domainIntegrations={domainIntegrations}
        />
        <SidebarInset>
          <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4">
            <SidebarTrigger className="-ml-1 text-muted-foreground hover:text-foreground" />
            <Separator
              orientation="vertical"
              className="mr-1 data-[orientation=vertical]:h-4"
            />
            <DashboardBreadcrumbs domainIntegrations={domainIntegrations} />
            {headerActions ? (
              <div
                data-slot="dashboard-header-actions"
                className="flex shrink-0 items-center gap-2"
              >
                {headerActions}
              </div>
            ) : null}
          </header>
          <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-4 p-4 md:gap-6 md:p-6">
            {children}
          </div>
        </SidebarInset>
      </BreadcrumbEntityLabelsProvider>
    </SidebarProvider>
  );
};
