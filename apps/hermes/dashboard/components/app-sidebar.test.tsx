import React from "react";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppSidebar } from "./app-sidebar";
import type { DashboardPage } from "@hermes/domain-contract";

const usePathnameMock = vi.fn();

vi.mock("next/navigation", () => ({
  usePathname: () => usePathnameMock(),
}));

vi.mock("@/app/dashboard/logout-form", () => ({
  LogoutForm: ({ className }: { className?: string }) => (
    <button data-testid="logout-form" className={className}>
      Sign out
    </button>
  ),
}));

vi.mock("@workspace/ui/components/sidebar", () => ({
  Sidebar: ({ children, ...props }: React.PropsWithChildren) => (
    <aside data-testid="sidebar" {...props}>
      {children}
    </aside>
  ),
  SidebarHeader: ({ children }: React.PropsWithChildren) => (
    <div data-testid="sidebar-header">{children}</div>
  ),
  SidebarContent: ({ children }: React.PropsWithChildren) => (
    <div data-testid="sidebar-content">{children}</div>
  ),
  SidebarFooter: ({ children }: React.PropsWithChildren) => (
    <div data-testid="sidebar-footer">{children}</div>
  ),
  SidebarGroup: ({ children }: React.PropsWithChildren) => (
    <div data-testid="sidebar-group">{children}</div>
  ),
  SidebarGroupLabel: ({ children }: React.PropsWithChildren) => (
    <span data-testid="sidebar-group-label">{children}</span>
  ),
  SidebarGroupContent: ({ children }: React.PropsWithChildren) => (
    <div data-testid="sidebar-group-content">{children}</div>
  ),
  SidebarMenu: ({ children }: React.PropsWithChildren) => (
    <nav data-testid="sidebar-menu">{children}</nav>
  ),
  SidebarMenuItem: ({ children }: React.PropsWithChildren) => (
    <div data-testid="sidebar-menu-item">{children}</div>
  ),
  SidebarMenuButton: ({
    children,
    isActive,
  }: React.PropsWithChildren<{
    asChild?: boolean;
    isActive?: boolean;
    size?: string;
  }>) => (
    <div data-testid="sidebar-menu-button" data-active={isActive}>
      {children}
    </div>
  ),
}));

vi.mock("./nav-user", () => ({
  NavUser: ({ user }: { user: { name: string; email: string } }) => (
    <div data-testid="nav-user">
      <span>{user.name}</span>
      <span>{user.email}</span>
    </div>
  ),
}));

vi.mock("@workspace/ui/components/separator", () => ({
  Separator: ({ className }: { className?: string }) => (
    <hr data-testid="separator" className={className} />
  ),
}));

const domainPages: DashboardPage[] = [
  {
    id: "tickers",
    label: "Tickers",
    pathSegment: "tickers",
    template: "table-v1",
    apiPrefix: "/v1/hermes-dashboard/tickers",
    columns: [],
    searchableFields: [],
    sortableFields: [],
    actions: { create: true, update: true, delete: true, view: false },
    order: 10,
    customActions: [],
    createNavigation: "modal",
  },
  {
    id: "search-queries",
    label: "Search Query",
    pathSegment: "search-queries",
    template: "table-v1",
    apiPrefix: "/v1/hermes-dashboard/search-queries",
    columns: [],
    searchableFields: [],
    sortableFields: [],
    actions: { create: false, update: false, delete: true, view: false },
    order: 20,
    customActions: [],
    createNavigation: "modal",
  },
  {
    id: "entity-types",
    label: "Entity Types",
    pathSegment: "entity-types",
    template: "table-v1",
    apiPrefix: "/v1/hermes-dashboard/entity-types",
    columns: [],
    searchableFields: [],
    sortableFields: [],
    actions: { create: true, update: true, delete: true, view: false },
    order: 30,
    customActions: [],
    createNavigation: "modal",
  },
  {
    id: "relation-types",
    label: "Relation Types",
    pathSegment: "relation-types",
    template: "table-v1",
    apiPrefix: "/v1/hermes-dashboard/relation-types",
    columns: [],
    searchableFields: [],
    sortableFields: [],
    actions: { create: true, update: true, delete: true, view: false },
    order: 40,
    customActions: [],
    createNavigation: "modal",
  },
];

const domainIntegrations = [
  {
    integrationId: "mediapulse",
    name: "Mediapulse",
    pages: domainPages,
  },
];

describe("AppSidebar", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    usePathnameMock.mockReset();
  });

  it("renders the Hermes logo text", () => {
    usePathnameMock.mockReturnValue("/dashboard");

    render(<AppSidebar domainIntegrations={domainIntegrations} />);

    expect(screen.getByText("Hermes")).toBeInTheDocument();
  });

  it("renders Hermes grouped main nav and integration-grouped domain links", () => {
    usePathnameMock.mockReturnValue("/dashboard");

    render(<AppSidebar domainIntegrations={domainIntegrations} />);

    const groupLabels = screen
      .getAllByTestId("sidebar-group-label")
      .map((el) => el.textContent);
    expect(groupLabels).toEqual([
      "Overview",
      "Orchestration",
      "Agents",
      "Platform",
      "Mediapulse",
    ]);
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Pipelines")).toBeInTheDocument();
    expect(screen.getByText("Mediapulse")).toBeInTheDocument();
    expect(screen.getByText("Tickers")).toBeInTheDocument();
    expect(screen.getByText("Search Query")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Agents" })).toBeInTheDocument();
    expect(screen.getByText("Agent configs")).toBeInTheDocument();
    expect(screen.getByText("Variables")).toBeInTheDocument();
    expect(screen.getByText("HTTP triggers")).toBeInTheDocument();
    expect(screen.getByText("Admins")).toBeInTheDocument();
    expect(screen.getByText("Domain integrations")).toBeInTheDocument();
    expect(screen.getByText("Schedules")).toBeInTheDocument();
    expect(screen.getByText("Entity Types")).toBeInTheDocument();
    expect(screen.getByText("Relation Types")).toBeInTheDocument();
  });

  it("marks Dashboard as active when on /dashboard", () => {
    usePathnameMock.mockReturnValue("/dashboard");

    render(<AppSidebar domainIntegrations={domainIntegrations} />);

    const buttons = screen.getAllByTestId("sidebar-menu-button");
    const dashboardButton = buttons.find((btn) =>
      btn.textContent?.includes("Dashboard"),
    );
    expect(dashboardButton).toHaveAttribute("data-active", "true");
  });

  it("marks Tickers as active when on keyed tickers path", () => {
    usePathnameMock.mockReturnValue("/dashboard/mediapulse/tickers");

    render(<AppSidebar domainIntegrations={domainIntegrations} />);

    const buttons = screen.getAllByTestId("sidebar-menu-button");
    const tickersButton = buttons.find((btn) =>
      btn.textContent?.includes("Tickers"),
    );
    expect(tickersButton).toHaveAttribute("data-active", "true");
  });

  it("marks Agents as active when on /dashboard/agents", () => {
    usePathnameMock.mockReturnValue("/dashboard/agents");

    render(<AppSidebar domainIntegrations={domainIntegrations} />);

    const buttons = screen.getAllByTestId("sidebar-menu-button");
    const agentsButton = buttons.find((btn) =>
      btn.textContent?.includes("Agents"),
    );
    expect(agentsButton).toHaveAttribute("data-active", "true");
  });

  it("marks Domain integrations as active when on /dashboard/domain-integrations", () => {
    usePathnameMock.mockReturnValue("/dashboard/domain-integrations");

    render(<AppSidebar domainIntegrations={domainIntegrations} />);

    const buttons = screen.getAllByTestId("sidebar-menu-button");
    const domainIntegrationsButton = buttons.find((btn) =>
      btn.textContent?.includes("Domain integrations"),
    );
    expect(domainIntegrationsButton).toHaveAttribute("data-active", "true");
  });

  it("marks Search Query as active when on keyed search-queries path", () => {
    usePathnameMock.mockReturnValue("/dashboard/mediapulse/search-queries");

    render(<AppSidebar domainIntegrations={domainIntegrations} />);

    const buttons = screen.getAllByTestId("sidebar-menu-button");
    const searchQueriesButton = buttons.find((btn) =>
      btn.textContent?.includes("Search Query"),
    );
    expect(searchQueriesButton).toHaveAttribute("data-active", "true");
  });

  it("marks Schedules as active when on /dashboard/schedules", () => {
    usePathnameMock.mockReturnValue("/dashboard/schedules");

    render(<AppSidebar domainIntegrations={domainIntegrations} />);

    const buttons = screen.getAllByTestId("sidebar-menu-button");
    const schedulesButton = buttons.find((btn) =>
      btn.textContent?.includes("Schedules"),
    );
    expect(schedulesButton).toHaveAttribute("data-active", "true");
  });

  it("marks Entity Types as active when on keyed entity-types path", () => {
    usePathnameMock.mockReturnValue("/dashboard/mediapulse/entity-types");

    render(<AppSidebar domainIntegrations={domainIntegrations} />);

    const buttons = screen.getAllByTestId("sidebar-menu-button");
    const entityTypesButton = buttons.find((btn) =>
      btn.textContent?.includes("Entity Types"),
    );
    expect(entityTypesButton).toHaveAttribute("data-active", "true");
  });

  it("marks Relation Types as active when on keyed relation-types path", () => {
    usePathnameMock.mockReturnValue("/dashboard/mediapulse/relation-types");

    render(<AppSidebar domainIntegrations={domainIntegrations} />);

    const buttons = screen.getAllByTestId("sidebar-menu-button");
    const relationTypesButton = buttons.find((btn) =>
      btn.textContent?.includes("Relation Types"),
    );
    expect(relationTypesButton).toHaveAttribute("data-active", "true");
  });

  it("renders NavUser with name and email when user prop provided", () => {
    usePathnameMock.mockReturnValue("/dashboard");
    const user = { name: "John Doe", email: "john@example.com" };

    render(<AppSidebar user={user} domainIntegrations={domainIntegrations} />);

    expect(screen.getByTestId("nav-user")).toBeInTheDocument();
    expect(screen.getByText("John Doe")).toBeInTheDocument();
    expect(screen.getByText("john@example.com")).toBeInTheDocument();
  });

  it("renders logout form (no NavUser) when no user provided", () => {
    usePathnameMock.mockReturnValue("/dashboard");

    render(<AppSidebar domainIntegrations={domainIntegrations} />);

    expect(screen.getByTestId("logout-form")).toBeInTheDocument();
    expect(screen.queryByTestId("nav-user")).not.toBeInTheDocument();
  });

  it("renders logout form (no NavUser) when user is null", () => {
    usePathnameMock.mockReturnValue("/dashboard");

    render(<AppSidebar user={null} domainIntegrations={domainIntegrations} />);

    expect(screen.getByTestId("logout-form")).toBeInTheDocument();
    expect(screen.queryByTestId("nav-user")).not.toBeInTheDocument();
  });
});
