import React from "react";
import { act, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { DashboardPage } from "@hermes/domain-contract";

import { BreadcrumbEntityLabel } from "./breadcrumb-entity-label";
import { DashboardShell } from "./dashboard-shell";

const mediapulsePages: DashboardPage[] = [
  {
    id: "tickers",
    label: "Tickers",
    pathSegment: "tickers",
    kind: "resource-table",
    placement: "sidebar",
    apiPrefix: "/v1/hermes-dashboard/tickers",
    columns: [],
    searchableFields: [],
    sortableFields: [],
    actions: { create: true, update: true, delete: true, view: false },
    order: 0,
    customActions: [],
    createNavigation: "modal",
  },
];

const PIPELINE_ID = "550e8400-e29b-41d4-a716-446655440000";

const usePathnameMock = vi.fn();

vi.mock("next/navigation", () => ({
  usePathname: () => usePathnameMock(),
}));

vi.mock("./command-palette", () => ({
  CommandPalette: () => null,
}));

vi.mock("./app-sidebar", () => ({
  AppSidebar: ({
    user,
  }: {
    user?: { name: string; email: string } | null;
    domainIntegrations?: unknown;
  }) => (
    <aside data-testid="app-sidebar" data-user={user?.name ?? "none"}>
      Sidebar
    </aside>
  ),
}));

vi.mock("@workspace/ui/components/sidebar", () => ({
  SidebarProvider: ({
    children,
    defaultOpen,
    style,
  }: React.PropsWithChildren<{
    defaultOpen?: boolean;
    style?: React.CSSProperties;
  }>) => (
    <div
      data-testid="sidebar-provider"
      data-default-open={String(defaultOpen)}
      style={style}
    >
      {children}
    </div>
  ),
  SidebarInset: ({ children }: React.PropsWithChildren) => (
    <main data-testid="sidebar-inset">{children}</main>
  ),
  SidebarTrigger: ({ className }: { className?: string }) => (
    <button data-testid="sidebar-trigger" className={className}>
      Toggle
    </button>
  ),
}));

vi.mock("@workspace/ui/components/separator", () => ({
  Separator: ({
    orientation,
    className,
  }: {
    orientation?: string;
    className?: string;
  }) => (
    <hr
      data-testid="separator"
      data-orientation={orientation}
      className={className}
    />
  ),
}));

const noIntegrations = Promise.resolve([]);

const renderShell = async (element: React.ReactElement) => {
  await act(async () => {
    render(element);
  });
};

const renderAt = async (
  pathname: string,
  children: React.ReactNode = <div>Content</div>,
  domainIntegrations: Promise<
    { integrationId: string; name: string; views: DashboardPage[] }[]
  > = noIntegrations,
) => {
  usePathnameMock.mockReturnValue(pathname);
  await renderShell(
    <DashboardShell domainIntegrations={domainIntegrations}>
      {children}
    </DashboardShell>,
  );
};

describe("DashboardShell", () => {
  afterEach(() => {
    usePathnameMock.mockReset();
  });

  it("renders children in a full-width container-query content area", async () => {
    await renderAt("/dashboard");

    const content = screen.getByText("Content").parentElement;

    expect(content).toHaveClass("@container/main", "flex-1");
    expect(content).not.toHaveClass("max-w-7xl");
  });

  it("sizes the sidebar and header the way dashboard-01 does", async () => {
    await renderAt("/dashboard");

    const provider = screen.getByTestId("sidebar-provider");

    expect(provider.style.getPropertyValue("--sidebar-width")).toBe(
      "calc(var(--spacing) * 72)",
    );
    expect(provider.style.getPropertyValue("--header-height")).toBe(
      "calc(var(--spacing) * 12)",
    );
  });

  it("opens the sidebar by default and honours a collapsed default", async () => {
    await renderAt("/dashboard");

    expect(screen.getByTestId("sidebar-provider")).toHaveAttribute(
      "data-default-open",
      "true",
    );
  });

  it("passes the user to the app sidebar", async () => {
    usePathnameMock.mockReturnValue("/dashboard");

    await renderShell(
      <DashboardShell
        domainIntegrations={noIntegrations}
        user={{ name: "Ada", email: "ada@example.com" }}
      >
        <div>Content</div>
      </DashboardShell>,
    );

    expect(screen.getByTestId("app-sidebar")).toHaveAttribute(
      "data-user",
      "Ada",
    );
  });

  it("shows the sidebar trigger and the page title in the header", async () => {
    await renderAt("/dashboard/schedules");

    expect(screen.getByTestId("sidebar-trigger")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Schedules",
    );
  });

  it("shows the parent section as a link before a detail title", async () => {
    await renderAt(`/dashboard/pipelines/${PIPELINE_ID}`);

    expect(screen.getByRole("link", { name: "Pipelines" })).toHaveAttribute(
      "href",
      "/dashboard/pipelines",
    );
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Pipeline",
    );
  });

  it("uses the entity label published by the page content", async () => {
    await renderAt(
      `/dashboard/pipelines/${PIPELINE_ID}`,
      <BreadcrumbEntityLabel segment={PIPELINE_ID} label="Nightly ingest" />,
    );

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Nightly ingest",
    );
  });

  it("names integration pages from the integration nav", async () => {
    await renderAt(
      "/dashboard/mediapulse/tickers",
      <div>Content</div>,
      Promise.resolve([
        {
          integrationId: "mediapulse",
          name: "MediaPulse",
          views: mediapulsePages,
        },
      ]),
    );

    const header = screen.getByRole("banner");

    expect(header).toHaveTextContent("MediaPulse");
    expect(within(header).getByRole("heading", { level: 1 })).toHaveTextContent(
      "Tickers",
    );
  });

  it("offers Quick Create in the header", async () => {
    await renderAt("/dashboard");

    expect(
      screen.getByRole("button", { name: "Quick create" }),
    ).toBeInTheDocument();
  });
});
