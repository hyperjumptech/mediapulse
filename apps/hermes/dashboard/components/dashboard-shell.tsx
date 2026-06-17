"use client";

import { usePathname } from "next/navigation";
import type { DashboardView } from "@hermes/domain-contract";

import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@workspace/ui/components/sidebar";
import { Separator } from "@workspace/ui/components/separator";

import { AppSidebar } from "./app-sidebar";

export type DashboardUser = { name: string; email: string };

const SEGMENT_LABELS: Record<string, string> = {
  agents: "Agents",
  "agent-configs": "Agent configs",
  "domain-integrations": "Domain integrations",
  pipelines: "Pipelines",
  schedules: "Schedules",
  variables: "Variables",
  admins: "Admins",
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
 * Derives the breadcrumb page label for agents/content-generation-runs sub-routes.
 */
const getAgentsContentGenerationRunsSubLabel = (
  subSegment: string | undefined,
): string | null => {
  if (!subSegment) return null;
  if (UUID_REGEX.test(subSegment)) return "Run detail";
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
  integrationId: string;
  name: string;
  views: DashboardView[];
};

/**
 * Renders the dashboard shell: sidebar, header title, and main content.
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
  const domainResourcePath = segments.slice(2).join("/");

  const domainIntegration =
    first && domainIntegrations.find((i) => i.integrationId === first);
  const isDomainKeyedRoute = Boolean(domainIntegration && second);

  const domainViewLabel =
    domainIntegration && domainResourcePath
      ? domainIntegration.views.find(
          (view) =>
            view.pathSegment === domainResourcePath ||
            view.pathSegment === second,
        )?.label
      : undefined;

  const pipelinesSubLabel =
    first === "pipelines" ? getPipelinesSubLabel(second) : null;
  const agentsSubLabel = first === "agents" ? getAgentsSubLabel(second) : null;
  const agentsThird = segments[3];
  const contentGenerationRunsSubLabel =
    first === "agents" && second === "content-generation-runs"
      ? getAgentsContentGenerationRunsSubLabel(agentsThird)
      : null;
  // Label for the CGA diagnostics list page (targeted check — avoids changing
  // the general hermesSegmentLabel logic which affects all routes).
  const cgaDiagnosticsLabel =
    first === "agents" && second === "content-generation-runs" && !agentsThird
      ? "CGA diagnostics"
      : null;
  const schedulesSubLabel =
    first === "schedules" ? getSchedulesSubLabel(second) : null;
  const domainIntegrationsSubLabel =
    first === "domain-integrations"
      ? getDomainIntegrationsSubLabel(second)
      : null;

  const hermesSegmentLabel =
    first && !isDomainKeyedRoute ? SEGMENT_LABELS[first] : undefined;

  const currentLabel = isDomainKeyedRoute
    ? (domainViewLabel ?? second ?? "Dashboard")
    : (pipelinesSubLabel ??
      contentGenerationRunsSubLabel ??
      cgaDiagnosticsLabel ??
      agentsSubLabel ??
      schedulesSubLabel ??
      domainIntegrationsSubLabel ??
      hermesSegmentLabel ??
      "Dashboard");

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties
      }
    >
      <AppSidebar
        user={user ?? null}
        domainIntegrations={domainIntegrations}
        variant="inset"
      />
      <SidebarInset>
        <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
          <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
            <SidebarTrigger className="-ml-1" />
            <Separator
              orientation="vertical"
              className="mx-2 data-[orientation=vertical]:h-4"
            />
            <h1 className="text-base font-medium">{currentLabel}</h1>
          </div>
        </header>
        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col gap-2">
            <div className="flex flex-col gap-4 px-4 py-4 md:gap-6 md:py-6 lg:px-6">
              {children}
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
};
