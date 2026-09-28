"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, use, useCallback, type ComponentProps } from "react";
import { Database, Workflow, type LucideIcon } from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarRail,
  useSidebar,
} from "@workspace/ui/components/sidebar";
import { cn } from "@workspace/ui/lib/utils";

import { LogoutForm } from "@/app/dashboard/logout-form";
import {
  buildDomainIntegrationViewHref,
  dashboardNavGroups,
  DASHBOARD_ROOT_PATH,
  isDashboardPathActive,
  type DomainIntegrationNav,
} from "@/lib/dashboard-routes";

import type { DashboardUser } from "./dashboard-shell";
import { NavUser } from "./nav-user";

type AppSidebarProps = ComponentProps<typeof Sidebar> & {
  user?: DashboardUser | null;
  domainIntegrations: Promise<DomainIntegrationNav[]>;
};

type SidebarNavLinkProps = {
  href: string;
  label: string;
  icon: LucideIcon;
  isActive: boolean;
};

type DomainIntegrationNavGroupsProps = {
  domainIntegrations: Promise<DomainIntegrationNav[]>;
  pathname: string | null;
};

const navSkeletonRowKeys = ["first", "second", "third"];

const useCloseMobileSidebar = () => {
  const { isMobile, setOpenMobile } = useSidebar();

  return useCallback(() => {
    if (isMobile) {
      setOpenMobile(false);
    }
  }, [isMobile, setOpenMobile]);
};

const NavLinkPendingIndicator = () => {
  const { pending } = useLinkStatus();

  return (
    <span
      aria-hidden
      className={cn(
        "ml-auto size-1.5 shrink-0 rounded-full bg-sidebar-foreground/50 transition-opacity delay-100 group-data-[collapsible=icon]:hidden",
        pending ? "animate-pulse opacity-100" : "opacity-0",
      )}
    />
  );
};

const SidebarNavLink = ({
  href,
  label,
  icon: Icon,
  isActive,
}: SidebarNavLinkProps) => {
  const closeMobileSidebar = useCloseMobileSidebar();

  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={isActive} tooltip={label}>
        <Link
          href={href}
          aria-current={isActive ? "page" : undefined}
          onClick={closeMobileSidebar}
        >
          <Icon />
          <span className="truncate">{label}</span>
          <NavLinkPendingIndicator />
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
};

const HermesNavGroups = ({ pathname }: { pathname: string | null }) =>
  dashboardNavGroups.map((group) => (
    <SidebarGroup key={group.label}>
      <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {group.items.map((item) => (
            <SidebarNavLink
              key={item.href}
              href={item.href}
              label={item.label}
              icon={item.icon}
              isActive={isDashboardPathActive(pathname, item.href)}
            />
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  ));

const DomainIntegrationNavGroups = ({
  domainIntegrations,
  pathname,
}: DomainIntegrationNavGroupsProps) => {
  const resolvedDomainIntegrations = use(domainIntegrations);

  return resolvedDomainIntegrations.map((integration) => (
    <SidebarGroup key={integration.integrationId}>
      <SidebarGroupLabel>{integration.name}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {integration.views.map((view) => {
            const href = buildDomainIntegrationViewHref(
              integration.integrationId,
              view,
            );

            return (
              <SidebarNavLink
                key={`${integration.integrationId}-${view.id}`}
                href={href}
                label={view.label}
                icon={Database}
                isActive={isDashboardPathActive(pathname, href)}
              />
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
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
      <SidebarMenuButton asChild size="lg" tooltip="Hermes">
        <Link href={DASHBOARD_ROOT_PATH}>
          <span className="flex aspect-square size-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-foreground text-sidebar">
            <Workflow className="size-4" />
          </span>
          <span className="grid flex-1 text-left leading-tight">
            <span className="truncate text-sm font-semibold">Hermes</span>
            <span className="truncate text-xs text-sidebar-foreground/60">
              Orchestration
            </span>
          </span>
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
    <Sidebar collapsible="icon" variant="inset" {...props}>
      <SidebarHeader>
        <SidebarBrand />
      </SidebarHeader>

      <SidebarContent>
        <HermesNavGroups pathname={pathname} />
        <Suspense fallback={<DomainIntegrationNavSkeleton />}>
          <DomainIntegrationNavGroups
            domainIntegrations={domainIntegrations}
            pathname={pathname}
          />
        </Suspense>
      </SidebarContent>

      <SidebarFooter>
        {user ? (
          <NavUser user={user} />
        ) : (
          <SidebarMenu>
            <SidebarMenuItem>
              <LogoutForm
                className="w-full group-data-[collapsible=icon]:hidden"
                variant="ghost"
                buttonClassName="w-full justify-start gap-2 rounded-md px-2 py-1.5 text-sm text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              />
            </SidebarMenuItem>
          </SidebarMenu>
        )}
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
};
