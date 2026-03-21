"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { DashboardPage } from "@hermes/domain-contract";
import {
  Bot,
  Calendar,
  Database,
  FileJson,
  GitBranch,
  Key,
  LayoutDashboard,
  Variable,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@workspace/ui/components/sidebar";
import { Separator } from "@workspace/ui/components/separator";

import { LogoutForm } from "@/app/dashboard/logout-form";

import type { DashboardUser } from "./dashboard-shell";

type AppSidebarProps = React.ComponentProps<typeof Sidebar> & {
  user?: DashboardUser | null;
  /** Active domain integrations and their manifest pages (keyed URLs). */
  domainIntegrations?: Array<{
    key: string;
    name: string;
    pages: DashboardPage[];
  }>;
};

/**
 * Hermes app sidebar matching dashboard-01. Main nav (Dashboard, Pipelines) and footer with user and logout.
 */
export const AppSidebar = ({
  user,
  domainIntegrations = [],
  ...props
}: AppSidebarProps) => {
  const pathname = usePathname();
  const isDashboard = pathname === "/dashboard";
  const isPipelines = pathname === "/dashboard/pipelines";
  const isAgents = pathname?.startsWith("/dashboard/agents") ?? false;
  const isAgentConfigs =
    pathname?.startsWith("/dashboard/agent-configs") ?? false;
  const isVariables = pathname?.startsWith("/dashboard/variables") ?? false;
  const isApiKeys = pathname?.startsWith("/dashboard/api-keys") ?? false;
  const isSchedules = pathname?.startsWith("/dashboard/schedules") ?? false;

  return (
    <Sidebar {...props}>
      <div className="flex h-16 shrink-0 flex-col transition-[height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
        <div className="flex flex-1 items-center px-4">
          <span className="text-lg font-semibold text-sidebar-foreground">
            Hermes
          </span>
        </div>
        <Separator className="w-full bg-sidebar-border" />
      </div>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Main</SidebarGroupLabel>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={isDashboard}>
                <Link href="/dashboard">
                  <LayoutDashboard className="size-4" />
                  <span>Dashboard</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={isPipelines}>
                <Link href="/dashboard/pipelines">
                  <GitBranch className="size-4" />
                  <span>Pipelines</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={isAgents}>
                <Link href="/dashboard/agents">
                  <Bot className="size-4" />
                  <span>Agents</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={isAgentConfigs}>
                <Link href="/dashboard/agent-configs">
                  <FileJson className="size-4" />
                  <span>Agent configs</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={isVariables}>
                <Link href="/dashboard/variables">
                  <Variable className="size-4" />
                  <span>Variables</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={isApiKeys}>
                <Link href="/dashboard/api-keys">
                  <Key className="size-4" />
                  <span>API Keys</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={isSchedules}>
                <Link href="/dashboard/schedules">
                  <Calendar className="size-4" />
                  <span>Schedules</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>
        {domainIntegrations.map((integration) => (
          <SidebarGroup key={integration.key}>
            <SidebarGroupLabel>{integration.name}</SidebarGroupLabel>
            <SidebarMenu>
              {integration.pages.map((page) => {
                const href = `/dashboard/${integration.key}/${page.pathSegment}`;
                return (
                  <SidebarMenuItem key={`${integration.key}-${page.id}`}>
                    <SidebarMenuButton
                      asChild
                      isActive={
                        pathname === href || pathname?.startsWith(`${href}/`)
                      }
                    >
                      <Link href={href}>
                        <Database className="size-4" />
                        <span>{page.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          {user ? (
            <>
              <SidebarMenuItem>
                <div className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm">
                  <div className="grid flex-1 min-w-0 text-left leading-tight">
                    <span className="truncate font-medium text-sidebar-foreground">
                      {user.name}
                    </span>
                    <span className="truncate text-xs text-sidebar-foreground/80">
                      {user.email}
                    </span>
                  </div>
                </div>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <LogoutForm
                  className="w-full"
                  variant="ghost"
                  buttonClassName="w-full justify-start gap-2 rounded-md px-2 py-1.5 text-sm text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                />
              </SidebarMenuItem>
            </>
          ) : (
            <SidebarMenuItem>
              <LogoutForm
                className="w-full"
                variant="ghost"
                buttonClassName="w-full justify-start gap-2 rounded-md px-2 py-1.5 text-sm text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              />
            </SidebarMenuItem>
          )}
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
};
