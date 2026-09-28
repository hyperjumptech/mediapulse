"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, use } from "react";
import type { DashboardView } from "@hermes/domain-contract";
import {
  Bot,
  Calendar,
  Database,
  FileJson,
  FileText,
  GitBranch,
  LayoutDashboard,
  Plug,
  Radio,
  KeyRound,
  Users,
  Variable,
} from "lucide-react";

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
} from "@workspace/ui/components/sidebar";
import { cn } from "@workspace/ui/lib/utils";

import { LogoutForm } from "@/app/dashboard/logout-form";
import { NavUser } from "./nav-user";
import type { DashboardUser } from "./dashboard-shell";

type DomainIntegrationNavItem = {
  integrationId: string;
  name: string;
  views: DashboardView[];
};

type AppSidebarProps = React.ComponentProps<typeof Sidebar> & {
  user?: DashboardUser | null;
  domainIntegrations: Promise<DomainIntegrationNavItem[]>;
};

const mainNavGroups = [
  {
    label: "Overview",
    items: [{ href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" }],
  },
  {
    label: "Orchestration",
    items: [
      { href: "/dashboard/pipelines", icon: GitBranch, label: "Pipelines" },
      { href: "/dashboard/schedules", icon: Calendar, label: "Schedules" },
      { href: "/dashboard/http-triggers", icon: Radio, label: "HTTP triggers" },
    ],
  },
  {
    label: "Agents",
    items: [
      { href: "/dashboard/agents", icon: Bot, label: "Agents" },
      {
        href: "/dashboard/agent-configs",
        icon: FileJson,
        label: "Agent configs",
      },
      {
        href: "/dashboard/agent-contracts",
        icon: FileText,
        label: "Agent contracts",
      },
      { href: "/dashboard/variables", icon: Variable, label: "Variables" },
    ],
  },
  {
    label: "Platform",
    items: [
      {
        href: "/dashboard/domain-integrations",
        icon: Plug,
        label: "Domain integrations",
      },
      { href: "/dashboard/api-keys", icon: KeyRound, label: "API keys" },
      { href: "/dashboard/admins", icon: Users, label: "Admins" },
    ],
  },
] as const;

const NavLinkPendingIndicator = () => {
  const { pending } = useLinkStatus();

  return (
    <span
      aria-hidden
      className={cn(
        "ml-auto size-1.5 shrink-0 rounded-full bg-sidebar-foreground/50 transition-opacity delay-100",
        pending ? "animate-pulse opacity-100" : "opacity-0",
      )}
    />
  );
};

const DomainIntegrationNavGroups = ({
  domainIntegrations,
}: {
  domainIntegrations: Promise<DomainIntegrationNavItem[]>;
}) => {
  const pathname = usePathname();
  const resolvedIntegrations = use(domainIntegrations);

  return resolvedIntegrations.map((integration) => (
    <SidebarGroup key={integration.integrationId}>
      <SidebarGroupLabel>{integration.name}</SidebarGroupLabel>
      <SidebarGroupContent className="flex flex-col gap-2">
        <SidebarMenu>
          {integration.views.map((view) => {
            const href = `/dashboard/${integration.integrationId}/${view.pathSegment}`;
            const isActive =
              pathname === href || (pathname?.startsWith(`${href}/`) ?? false);

            return (
              <SidebarMenuItem key={`${integration.integrationId}-${view.id}`}>
                <SidebarMenuButton asChild isActive={isActive}>
                  <Link href={href}>
                    <Database className="size-4" />
                    <span>{view.label}</span>
                    <NavLinkPendingIndicator />
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  ));
};

/**
 * Hermes app sidebar matching the Space app's design: SidebarHeader brand link, grouped nav
 * with SidebarGroupContent, domain integration pages, and a footer NavUser dropdown.
 *
 * @param props - Sidebar props, optional user, and domain integration pages.
 */
export const AppSidebar = ({
  user,
  domainIntegrations,
  ...props
}: AppSidebarProps) => {
  const pathname = usePathname();

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild className="!p-1.5">
              <Link href="/dashboard">
                <LayoutDashboard className="size-5!" />
                <span className="text-base font-semibold">Hermes</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {mainNavGroups.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarGroupContent className="flex flex-col gap-2">
              <SidebarMenu>
                {group.items.map((item) => {
                  const isActive =
                    item.href === "/dashboard"
                      ? pathname === "/dashboard"
                      : (pathname?.startsWith(item.href) ?? false);
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton asChild isActive={isActive}>
                        <Link href={item.href}>
                          <item.icon className="size-4" />
                          <span>{item.label}</span>
                          <NavLinkPendingIndicator />
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}

        <Suspense fallback={null}>
          <DomainIntegrationNavGroups domainIntegrations={domainIntegrations} />
        </Suspense>
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
