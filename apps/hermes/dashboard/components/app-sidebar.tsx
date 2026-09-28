"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, use, type ComponentProps } from "react";
import { Database, Workflow } from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
} from "@workspace/ui/components/sidebar";

import { LogoutForm } from "@/app/dashboard/logout-form";
import {
  buildDomainIntegrationViewHref,
  dashboardNavGroups,
  dashboardSecondaryNavItems,
  DASHBOARD_ROOT_PATH,
  type DomainIntegrationNav,
} from "@/lib/dashboard-routes";

import type { DashboardUser } from "./dashboard-shell";
import { NavMain, type NavMainItem } from "./nav-main";
import { NavSecondary } from "./nav-secondary";
import { NavUser } from "./nav-user";

type AppSidebarProps = ComponentProps<typeof Sidebar> & {
  user?: DashboardUser | null;
  domainIntegrations: Promise<DomainIntegrationNav[]>;
};

type DomainIntegrationNavGroupsProps = {
  domainIntegrations: Promise<DomainIntegrationNav[]>;
  pathname: string | null;
};

const DOMAIN_GROUP_VISIBLE_ITEM_COUNT = 4;

const navSkeletonRowKeys = ["first", "second", "third"];

const toDomainNavItems = (integration: DomainIntegrationNav): NavMainItem[] =>
  integration.views.map((view) => ({
    href: buildDomainIntegrationViewHref(integration.integrationId, view),
    label: view.label,
    icon: Database,
  }));

const DomainIntegrationNavGroups = ({
  domainIntegrations,
  pathname,
}: DomainIntegrationNavGroupsProps) => {
  const resolvedDomainIntegrations = use(domainIntegrations);

  return resolvedDomainIntegrations.map((integration) => (
    <NavMain
      key={integration.integrationId}
      label={integration.name}
      items={toDomainNavItems(integration)}
      pathname={pathname}
      visibleCount={DOMAIN_GROUP_VISIBLE_ITEM_COUNT}
    />
  ));
};

const DomainIntegrationNavSkeleton = () => (
  <SidebarGroup aria-hidden data-testid="domain-integration-nav-skeleton">
    <SidebarMenu>
      {navSkeletonRowKeys.map((rowKey) => (
        <SidebarMenuItem key={rowKey}>
          <SidebarMenuSkeleton showIcon />
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  </SidebarGroup>
);

const SidebarBrand = () => (
  <SidebarMenu>
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild
        className="data-[slot=sidebar-menu-button]:p-1.5!"
      >
        <Link href={DASHBOARD_ROOT_PATH}>
          <Workflow className="size-5!" />
          <span className="text-base font-semibold">Hermes</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  </SidebarMenu>
);

export const AppSidebar = ({
  user,
  domainIntegrations,
  ...props
}: AppSidebarProps) => {
  const pathname = usePathname();

  return (
    <Sidebar collapsible="offcanvas" variant="sidebar" {...props}>
      <SidebarHeader className="h-(--header-height) justify-center border-b">
        <SidebarBrand />
      </SidebarHeader>

      <SidebarContent>
        {dashboardNavGroups.map((group) => (
          <NavMain
            key={group.label}
            label={group.label}
            items={group.items}
            pathname={pathname}
          />
        ))}
        <Suspense fallback={<DomainIntegrationNavSkeleton />}>
          <DomainIntegrationNavGroups
            domainIntegrations={domainIntegrations}
            pathname={pathname}
          />
        </Suspense>
        <NavSecondary
          items={dashboardSecondaryNavItems}
          pathname={pathname}
          className="mt-auto"
        />
      </SidebarContent>

      <SidebarFooter>
        {user ? (
          <NavUser user={user} />
        ) : (
          <SidebarMenu>
            <SidebarMenuItem>
              <LogoutForm
                className="w-full"
                variant="ghost"
                buttonClassName="w-full justify-start gap-2 rounded-md px-2 py-1.5 text-sm text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              />
            </SidebarMenuItem>
          </SidebarMenu>
        )}
      </SidebarFooter>
    </Sidebar>
  );
};
