import React from "react";
import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { DashboardPage } from "@hermes/domain-contract";

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
const mediapulsePagesWithSearchQueries: DashboardPage[] = [
  ...mediapulsePages,
  {
    id: "search-queries",
    label: "Search Queries",
    pathSegment: "search-queries",
    kind: "resource-table",
    placement: "sidebar",
    apiPrefix: "/v1/hermes-dashboard/search-queries",
    columns: [],
    searchableFields: [],
    sortableFields: [],
    actions: { create: true, update: true, delete: true, view: false },
    order: 1,
    customActions: [],
    createNavigation: "modal",
  },
];

const usePathnameMock = vi.fn();

const noIntegrations = Promise.resolve([]);

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
  SidebarProvider: ({ children }: React.PropsWithChildren) => (
    <div data-testid="sidebar-provider">{children}</div>
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

describe("DashboardShell", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    usePathnameMock.mockReset();
  });

  it("renders children content", () => {
    // Setup
    usePathnameMock.mockReturnValue("/dashboard");

    // Act
    render(
      <DashboardShell domainIntegrations={noIntegrations}>
        <div data-testid="content">Dashboard Content</div>
      </DashboardShell>,
    );

    // Assert
    expect(screen.getByTestId("content")).toBeInTheDocument();
    expect(screen.getByText("Dashboard Content")).toBeInTheDocument();
  });

  it("renders sidebar provider wrapper", () => {
    // Setup
    usePathnameMock.mockReturnValue("/dashboard");

    // Act
    render(
      <DashboardShell domainIntegrations={noIntegrations}>
        <div>Content</div>
      </DashboardShell>,
    );

    // Assert
    expect(screen.getByTestId("sidebar-provider")).toBeInTheDocument();
  });

  it("renders app sidebar", () => {
    // Setup
    usePathnameMock.mockReturnValue("/dashboard");

    // Act
    render(
      <DashboardShell domainIntegrations={noIntegrations}>
        <div>Content</div>
      </DashboardShell>,
    );

    // Assert
    expect(screen.getByTestId("app-sidebar")).toBeInTheDocument();
  });

  it("passes user to app sidebar", () => {
    // Setup
    usePathnameMock.mockReturnValue("/dashboard");
    const user = { name: "Test User", email: "test@example.com" };

    // Act
    render(
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

  it("shows Dashboard title on /dashboard", () => {
    // Setup
    usePathnameMock.mockReturnValue("/dashboard");

    // Act
    render(
      <DashboardShell domainIntegrations={noIntegrations}>
        <div>Content</div>
      </DashboardShell>,
    );

    // Assert
    expect(
      screen.getByRole("heading", { name: "Dashboard" }),
    ).toBeInTheDocument();
  });

  it("shows Pipelines title on /dashboard/pipelines", () => {
    // Setup
    usePathnameMock.mockReturnValue("/dashboard/pipelines");

    // Act
    render(
      <DashboardShell domainIntegrations={noIntegrations}>
        <div>Content</div>
      </DashboardShell>,
    );

    // Assert
    expect(
      screen.getByRole("heading", { name: "Pipelines" }),
    ).toBeInTheDocument();
  });

  it("shows Tickers title on keyed /dashboard/mediapulse/tickers", async () => {
    usePathnameMock.mockReturnValue("/dashboard/mediapulse/tickers");

    await act(async () => {
      render(
        <DashboardShell
          domainIntegrations={Promise.resolve([
            {
              integrationId: "mediapulse",
              name: "Mediapulse",
              views: mediapulsePages,
            },
          ])}
        >
          <div>Content</div>
        </DashboardShell>,
      );
    });

    expect(
      await screen.findByRole("heading", { name: "Tickers" }),
    ).toBeInTheDocument();
  });

  it("shows Search Queries title on keyed /dashboard/mediapulse/search-queries", async () => {
    usePathnameMock.mockReturnValue("/dashboard/mediapulse/search-queries");

    await act(async () => {
      render(
        <DashboardShell
          domainIntegrations={Promise.resolve([
            {
              integrationId: "mediapulse",
              name: "Mediapulse",
              views: mediapulsePagesWithSearchQueries,
            },
          ])}
        >
          <div>Content</div>
        </DashboardShell>,
      );
    });

    expect(
      await screen.findByRole("heading", { name: "Search Queries" }),
    ).toBeInTheDocument();
  });

  it("shows Agents title on /dashboard/agents", () => {
    // Setup
    usePathnameMock.mockReturnValue("/dashboard/agents");

    // Act
    render(
      <DashboardShell domainIntegrations={noIntegrations}>
        <div>Content</div>
      </DashboardShell>,
    );

    // Assert
    expect(screen.getByRole("heading", { name: "Agents" })).toBeInTheDocument();
  });

  it("shows Domain integrations title on /dashboard/domain-integrations", () => {
    // Setup
    usePathnameMock.mockReturnValue("/dashboard/domain-integrations");

    // Act
    render(
      <DashboardShell domainIntegrations={noIntegrations}>
        <div>Content</div>
      </DashboardShell>,
    );

    // Assert
    expect(
      screen.getByRole("heading", { name: "Domain integrations" }),
    ).toBeInTheDocument();
  });

  it("shows Schedules title on /dashboard/schedules", () => {
    // Setup
    usePathnameMock.mockReturnValue("/dashboard/schedules");

    // Act
    render(
      <DashboardShell domainIntegrations={noIntegrations}>
        <div>Content</div>
      </DashboardShell>,
    );

    // Assert
    expect(
      screen.getByRole("heading", { name: "Schedules" }),
    ).toBeInTheDocument();
  });

  it("shows Pipeline title for UUID sub-route", () => {
    // Setup
    usePathnameMock.mockReturnValue(
      "/dashboard/pipelines/550e8400-e29b-41d4-a716-446655440000",
    );

    // Act
    render(
      <DashboardShell domainIntegrations={noIntegrations}>
        <div>Content</div>
      </DashboardShell>,
    );

    // Assert
    expect(
      screen.getByRole("heading", { name: "Pipeline" }),
    ).toBeInTheDocument();
  });

  it("shows sidebar trigger button", () => {
    // Setup
    usePathnameMock.mockReturnValue("/dashboard");

    // Act
    render(
      <DashboardShell domainIntegrations={noIntegrations}>
        <div>Content</div>
      </DashboardShell>,
    );

    // Assert
    expect(screen.getByTestId("sidebar-trigger")).toBeInTheDocument();
  });

  it("shows CGA diagnostics title on /dashboard/agents/content-generation-runs", () => {
    // Setup
    usePathnameMock.mockReturnValue(
      "/dashboard/agents/content-generation-runs",
    );

    // Act
    render(
      <DashboardShell domainIntegrations={noIntegrations}>
        <div>Content</div>
      </DashboardShell>,
    );

    // Assert
    expect(
      screen.getByRole("heading", { name: "CGA diagnostics" }),
    ).toBeInTheDocument();
  });

  it("shows Run detail title on /dashboard/agents/content-generation-runs/[id]", () => {
    // Setup
    usePathnameMock.mockReturnValue(
      "/dashboard/agents/content-generation-runs/550e8400-e29b-41d4-a716-446655440000",
    );

    // Act
    render(
      <DashboardShell domainIntegrations={noIntegrations}>
        <div>Content</div>
      </DashboardShell>,
    );

    // Assert
    expect(
      screen.getByRole("heading", { name: "Run detail" }),
    ).toBeInTheDocument();
  });

  it("handles null user gracefully", () => {
    // Setup
    usePathnameMock.mockReturnValue("/dashboard");

    // Act
    render(
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
});
