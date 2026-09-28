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
  }: React.PropsWithChildren<{ defaultOpen?: boolean }>) => (
    <div data-testid="sidebar-provider" data-default-open={String(defaultOpen)}>
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

const getBreadcrumbNavigation = () =>
  screen.getByRole("navigation", { name: "breadcrumb" });

describe("DashboardShell", () => {
  afterEach(() => {
    usePathnameMock.mockReset();
  });

  it("renders children inside the max-width content container", async () => {
    // Setup
    usePathnameMock.mockReturnValue("/dashboard");

    // Act
    await renderShell(
      <DashboardShell domainIntegrations={noIntegrations}>
        <div data-testid="content">Dashboard Content</div>
      </DashboardShell>,
    );

    // Assert
    const content = screen.getByTestId("content");

    expect(content).toHaveTextContent("Dashboard Content");
    expect(content.parentElement).toHaveClass("mx-auto", "max-w-7xl");
  });

  it("opens the sidebar by default", async () => {
    // Setup
    usePathnameMock.mockReturnValue("/dashboard");

    // Act
    await renderShell(
      <DashboardShell domainIntegrations={noIntegrations}>
        <div>Content</div>
      </DashboardShell>,
    );

    // Assert
    expect(screen.getByTestId("sidebar-provider")).toHaveAttribute(
      "data-default-open",
      "true",
    );
  });

  it("passes a collapsed default state to the sidebar provider", async () => {
    // Setup
    usePathnameMock.mockReturnValue("/dashboard");

    // Act
    await renderShell(
      <DashboardShell domainIntegrations={noIntegrations} defaultOpen={false}>
        <div>Content</div>
      </DashboardShell>,
    );

    // Assert
    expect(screen.getByTestId("sidebar-provider")).toHaveAttribute(
      "data-default-open",
      "false",
    );
  });

  it("passes the user to the app sidebar", async () => {
    // Setup
    usePathnameMock.mockReturnValue("/dashboard");
    const user = { name: "Test User", email: "test@example.com" };

    // Act
    await renderShell(
      <DashboardShell user={user} domainIntegrations={noIntegrations}>
        <div>Content</div>
      </DashboardShell>,
    );

    // Assert
    expect(screen.getByTestId("app-sidebar")).toHaveAttribute(
      "data-user",
      "Test User",
    );
  });

  it("handles a null user", async () => {
    // Setup
    usePathnameMock.mockReturnValue("/dashboard");

    // Act
    await renderShell(
      <DashboardShell user={null} domainIntegrations={noIntegrations}>
        <div>Content</div>
      </DashboardShell>,
    );

    // Assert
    expect(screen.getByTestId("app-sidebar")).toHaveAttribute(
      "data-user",
      "none",
    );
  });

  it("renders the sidebar trigger and a vertical separator in the header", async () => {
    // Setup
    usePathnameMock.mockReturnValue("/dashboard");

    // Act
    await renderShell(
      <DashboardShell domainIntegrations={noIntegrations}>
        <div>Content</div>
      </DashboardShell>,
    );

    // Assert
    const header = screen.getByRole("banner");

    expect(within(header).getByTestId("sidebar-trigger")).toBeInTheDocument();
    expect(within(header).getByTestId("separator")).toHaveAttribute(
      "data-orientation",
      "vertical",
    );
  });

  it("does not render a heading in the header", async () => {
    // Setup
    usePathnameMock.mockReturnValue("/dashboard/pipelines");

    // Act
    await renderShell(
      <DashboardShell domainIntegrations={noIntegrations}>
        <div>Content</div>
      </DashboardShell>,
    );

    // Assert
    expect(
      within(screen.getByRole("banner")).queryByRole("heading"),
    ).not.toBeInTheDocument();
  });

  it("renders breadcrumbs for the current path", async () => {
    // Setup
    usePathnameMock.mockReturnValue(`/dashboard/pipelines/${PIPELINE_ID}`);

    // Act
    await renderShell(
      <DashboardShell domainIntegrations={noIntegrations}>
        <div>Content</div>
      </DashboardShell>,
    );

    // Assert
    const breadcrumbNavigation = getBreadcrumbNavigation();

    expect(
      within(breadcrumbNavigation).getByRole("link", { name: "Pipelines" }),
    ).toHaveAttribute("href", "/dashboard/pipelines");
    expect(breadcrumbNavigation).toHaveTextContent("Pipeline");
  });

  it("shows an entity label published by the page content", async () => {
    // Setup
    usePathnameMock.mockReturnValue(`/dashboard/pipelines/${PIPELINE_ID}`);

    // Act
    await renderShell(
      <DashboardShell domainIntegrations={noIntegrations}>
        <BreadcrumbEntityLabel segment={PIPELINE_ID} label="Nightly ingest" />
      </DashboardShell>,
    );

    // Assert
    expect(getBreadcrumbNavigation()).toHaveTextContent("Nightly ingest");
  });

  it("uses integration nav data for integration breadcrumbs", async () => {
    // Setup
    usePathnameMock.mockReturnValue("/dashboard/mediapulse/tickers");
    const domainIntegrations = Promise.resolve([
      {
        integrationId: "mediapulse",
        name: "MediaPulse",
        views: mediapulsePages,
      },
    ]);

    // Act
    await renderShell(
      <DashboardShell domainIntegrations={domainIntegrations}>
        <div>Content</div>
      </DashboardShell>,
    );

    // Assert
    const breadcrumbNavigation = getBreadcrumbNavigation();

    expect(breadcrumbNavigation).toHaveTextContent("MediaPulse");
    expect(breadcrumbNavigation).toHaveTextContent("Tickers");
  });

  it("renders header actions when provided", async () => {
    // Setup
    usePathnameMock.mockReturnValue("/dashboard");

    // Act
    await renderShell(
      <DashboardShell
        domainIntegrations={noIntegrations}
        headerActions={<button type="button">Search</button>}
      >
        <div>Content</div>
      </DashboardShell>,
    );

    // Assert
    expect(
      within(screen.getByRole("banner")).getByRole("button", {
        name: "Search",
      }),
    ).toBeInTheDocument();
  });

  it("omits the header actions slot without actions", async () => {
    // Setup
    usePathnameMock.mockReturnValue("/dashboard");

    // Act
    await renderShell(
      <DashboardShell domainIntegrations={noIntegrations}>
        <div>Content</div>
      </DashboardShell>,
    );

    // Assert
    expect(
      document.querySelector('[data-slot="dashboard-header-actions"]'),
    ).not.toBeInTheDocument();
  });
});
