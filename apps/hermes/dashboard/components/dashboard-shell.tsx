"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { DashboardPage } from "@hermes/domain-contract";

import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@workspace/ui/components/sidebar";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@workspace/ui/components/breadcrumb";
import { Separator } from "@workspace/ui/components/separator";

import { AppSidebar } from "./app-sidebar";

export type DashboardUser = { name: string; email: string };

const HERMES_ROOT_SEGMENTS = new Set([
  "pipelines",
  "agents",
  "agent-configs",
  "variables",
  "domain-integrations",
  "schedules",
]);

const SEGMENT_LABELS: Record<string, string> = {
  agents: "Agents",
  "agent-configs": "Agent configs",
  "domain-integrations": "Domain integrations",
  pipelines: "Pipelines",
  schedules: "Schedules",
  variables: "Variables",
};

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Derives the breadcrumb page label for pipelines sub-routes ([id]).
 */
const getPipelinesSubLabel = (
  subSegment: string | undefined,
): string | null => {
  if (!subSegment) return null;
  if (UUID_REGEX.test(subSegment)) return "Pipeline";
  return null;
};

/**
 * Derives the breadcrumb page label for agents sub-routes ([id]).
 */
const getAgentsSubLabel = (subSegment: string | undefined): string | null => {
  if (!subSegment) return null;
  if (UUID_REGEX.test(subSegment)) return "Agent";
  return null;
};

/**
 * Derives the breadcrumb page label for schedules sub-routes (new, [id]).
 */
const getSchedulesSubLabel = (
  subSegment: string | undefined,
): string | null => {
  if (!subSegment) return null;
  if (subSegment === "new") return "New schedule";
  if (UUID_REGEX.test(subSegment)) return "Schedule";
  return null;
};

/**
 * Breadcrumb label for domain-integrations sub-routes (e.g. create).
 */
const getDomainIntegrationsSubLabel = (
  subSegment: string | undefined,
): string | null => {
  if (!subSegment) return null;
  if (subSegment === "create") return "New integration";
  return null;
};

export type DomainIntegrationNav = {
  key: string;
  name: string;
  pages: DashboardPage[];
};

/**
 * Renders the dashboard shell: sidebar (with user and logout in footer), header with breadcrumb, and main content.
 */
export const DashboardShell = ({
  children,
  user,
  domainIntegrations = [],
}: {
  children: React.ReactNode;
  user?: DashboardUser | null;
  domainIntegrations?: DomainIntegrationNav[];
}) => {
  const pathname = usePathname();
  const segments = pathname?.split("/").filter(Boolean) ?? [];
  const first = segments[1];
  const second = segments[2];

  const domainIntegration =
    first && domainIntegrations.find((i) => i.key === first);
  const isDomainKeyedRoute = Boolean(domainIntegration && second);

  const domainPageLabel =
    domainIntegration && second
      ? domainIntegration.pages.find((p) => p.pathSegment === second)?.label
      : undefined;

  const isHermesRoot = first ? HERMES_ROOT_SEGMENTS.has(first) : false;

  const pipelinesSubLabel =
    first === "pipelines" ? getPipelinesSubLabel(second) : null;
  const agentsSubLabel = first === "agents" ? getAgentsSubLabel(second) : null;
  const schedulesSubLabel =
    first === "schedules" ? getSchedulesSubLabel(second) : null;
  const domainIntegrationsSubLabel =
    first === "domain-integrations"
      ? getDomainIntegrationsSubLabel(second)
      : null;

  const hermesSegmentLabel =
    first && !isDomainKeyedRoute ? SEGMENT_LABELS[first] : undefined;

  const currentLabel = isDomainKeyedRoute
    ? (domainPageLabel ?? second ?? "Dashboard")
    : (pipelinesSubLabel ??
      agentsSubLabel ??
      schedulesSubLabel ??
      domainIntegrationsSubLabel ??
      hermesSegmentLabel ??
      "Dashboard");

  const showParentLink =
    Boolean(first) &&
    (isDomainKeyedRoute ||
      Boolean(
        pipelinesSubLabel ||
        agentsSubLabel ||
        schedulesSubLabel ||
        domainIntegrationsSubLabel,
      ) ||
      (isHermesRoot && first !== "pipelines"));

  return (
    <SidebarProvider>
      <AppSidebar user={user ?? null} domainIntegrations={domainIntegrations} />
      <Separator orientation="vertical" className="h-svh shrink-0" />
      <SidebarInset>
        <header className="flex h-16 shrink-0 flex-col transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
          <div className="flex flex-1 items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <Breadcrumb>
              <BreadcrumbList>
                {showParentLink ? (
                  <>
                    <BreadcrumbItem className="hidden md:block">
                      <BreadcrumbLink asChild>
                        <Link href="/dashboard">Dashboard</Link>
                      </BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator className="hidden md:block" />
                  </>
                ) : null}
                {isDomainKeyedRoute && domainIntegration ? (
                  <>
                    <BreadcrumbItem className="hidden md:block">
                      <BreadcrumbPage>{domainIntegration.name}</BreadcrumbPage>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator className="hidden md:block" />
                  </>
                ) : null}
                {pipelinesSubLabel ? (
                  <>
                    <BreadcrumbItem className="hidden md:block">
                      <BreadcrumbLink asChild>
                        <Link href="/dashboard/pipelines">Pipelines</Link>
                      </BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator className="hidden md:block" />
                  </>
                ) : null}
                {agentsSubLabel ? (
                  <>
                    <BreadcrumbItem className="hidden md:block">
                      <BreadcrumbLink asChild>
                        <Link href="/dashboard/agents">Agents</Link>
                      </BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator className="hidden md:block" />
                  </>
                ) : null}
                {schedulesSubLabel ? (
                  <>
                    <BreadcrumbItem className="hidden md:block">
                      <BreadcrumbLink asChild>
                        <Link href="/dashboard/schedules">Schedules</Link>
                      </BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator className="hidden md:block" />
                  </>
                ) : null}
                {domainIntegrationsSubLabel ? (
                  <>
                    <BreadcrumbItem className="hidden md:block">
                      <BreadcrumbLink asChild>
                        <Link href="/dashboard/domain-integrations">
                          Domain integrations
                        </Link>
                      </BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator className="hidden md:block" />
                  </>
                ) : null}
                <BreadcrumbItem>
                  <BreadcrumbPage>{currentLabel}</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
          <Separator className="w-full" />
        </header>
        <div className="flex flex-1 flex-col gap-4 p-4">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
};
