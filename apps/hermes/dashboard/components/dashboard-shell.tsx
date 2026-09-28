import type { CSSProperties, ReactNode } from "react";

import {
  SidebarInset,
  SidebarProvider,
} from "@workspace/ui/components/sidebar";

import type { DomainIntegrationNav } from "@/lib/dashboard-routes";

import { AppSidebar } from "./app-sidebar";
import { BreadcrumbEntityLabelsProvider } from "./breadcrumb-entity-label";
import { CommandPalette } from "./command-palette";
import { CommandPaletteProvider } from "./command-palette-provider";
import { SiteHeader } from "./site-header";

export type DashboardUser = { name: string; email: string };

export type { DomainIntegrationNav };

type DashboardShellProps = {
  children: ReactNode;
  user?: DashboardUser | null;
  domainIntegrations: Promise<DomainIntegrationNav[]>;
  defaultOpen?: boolean;
};

const shellStyle = {
  "--sidebar-width": "calc(var(--spacing) * 72)",
  "--header-height": "calc(var(--spacing) * 12)",
} as CSSProperties;

export const DashboardShell = ({
  children,
  user,
  domainIntegrations,
  defaultOpen = true,
}: DashboardShellProps) => (
  <SidebarProvider defaultOpen={defaultOpen} style={shellStyle}>
    <CommandPaletteProvider>
      <BreadcrumbEntityLabelsProvider>
        <AppSidebar
          user={user ?? null}
          domainIntegrations={domainIntegrations}
        />
        <SidebarInset>
          <SiteHeader domainIntegrations={domainIntegrations} />
          <div className="@container/main flex min-w-0 flex-1 flex-col gap-4 px-4 py-4 md:gap-6 md:py-6 lg:px-6">
            {children}
          </div>
        </SidebarInset>
        <CommandPalette domainIntegrations={domainIntegrations} />
      </BreadcrumbEntityLabelsProvider>
    </CommandPaletteProvider>
  </SidebarProvider>
);
