"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

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

const SEGMENT_LABELS: Record<string, string> = {
  pipelines: "Pipelines",
};

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Derives the breadcrumb page label for pipelines sub-routes (new, [id]).
 */
const getPipelinesSubLabel = (
  subSegment: string | undefined,
): string | null => {
  if (!subSegment) return null;
  if (subSegment === "new") return "New pipeline";
  if (UUID_REGEX.test(subSegment)) return "Pipeline";
  return null;
};

/**
 * Renders the dashboard shell: sidebar (with user and logout in footer), header with breadcrumb, and main content.
 */
export const DashboardShell = ({
  children,
  user,
}: {
  children: React.ReactNode;
  user?: DashboardUser | null;
}) => {
  const pathname = usePathname();
  const segments = pathname?.split("/").filter(Boolean) ?? [];
  const dashboardSegment = segments[1]; // e.g. "pipelines" for /dashboard/pipelines
  const subSegment = segments[2];
  const pipelinesSubLabel =
    dashboardSegment === "pipelines" ? getPipelinesSubLabel(subSegment) : null;
  const currentLabel =
    pipelinesSubLabel ??
    (dashboardSegment && SEGMENT_LABELS[dashboardSegment]) ??
    "Dashboard";
  const showParentLink =
    dashboardSegment && (pipelinesSubLabel || dashboardSegment !== "pipelines");

  return (
    <SidebarProvider>
      <AppSidebar user={user ?? null} />
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
