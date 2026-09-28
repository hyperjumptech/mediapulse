import { Separator } from "@workspace/ui/components/separator";
import { SidebarTrigger } from "@workspace/ui/components/sidebar";

import type { DomainIntegrationNav } from "@/lib/dashboard-routes";

import { DashboardPageTitle } from "./dashboard-page-title";
import { QuickCreateMenu } from "./quick-create-menu";

type SiteHeaderProps = {
  domainIntegrations: Promise<DomainIntegrationNav[]>;
};

export const SiteHeader = ({ domainIntegrations }: SiteHeaderProps) => (
  <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
    <div className="flex w-full min-w-0 items-center gap-1 px-4 lg:gap-2 lg:px-6">
      <SidebarTrigger className="-ml-1" />
      <Separator
        orientation="vertical"
        className="mx-2 data-[orientation=vertical]:h-4"
      />
      <DashboardPageTitle domainIntegrations={domainIntegrations} />
      <div className="ml-auto flex shrink-0 items-center gap-2">
        <QuickCreateMenu />
      </div>
    </div>
  </header>
);
