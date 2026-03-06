import React from "react";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DashboardShell } from "./dashboard-shell";

const usePathnameMock = vi.fn();

vi.mock("next/navigation", () => ({
  usePathname: () => usePathnameMock(),
}));

vi.mock("./app-sidebar", () => ({
  AppSidebar: ({ user }: { user?: { name: string; email: string } | null }) => (
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

vi.mock("@workspace/ui/components/breadcrumb", () => ({
  Breadcrumb: ({ children }: React.PropsWithChildren) => (
    <nav data-testid="breadcrumb">{children}</nav>
  ),
  BreadcrumbList: ({ children }: React.PropsWithChildren) => (
    <ol data-testid="breadcrumb-list">{children}</ol>
  ),
  BreadcrumbItem: ({
    children,
    className,
  }: React.PropsWithChildren<{ className?: string }>) => (
    <li data-testid="breadcrumb-item" className={className}>
      {children}
    </li>
  ),
  BreadcrumbLink: ({
    children,
  }: React.PropsWithChildren<{ asChild?: boolean }>) => (
    <span data-testid="breadcrumb-link">{children}</span>
  ),
  BreadcrumbPage: ({ children }: React.PropsWithChildren) => (
    <span data-testid="breadcrumb-page">{children}</span>
  ),
  BreadcrumbSeparator: ({ className }: { className?: string }) => (
    <span data-testid="breadcrumb-separator" className={className}>
      /
    </span>
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
      <DashboardShell>
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
      <DashboardShell>
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
      <DashboardShell>
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
      <DashboardShell user={user}>
        <div>Content</div>
      </DashboardShell>,
    );

    // Assert
    expect(screen.getByTestId("app-sidebar")).toHaveAttribute(
      "data-user",
      "Test User",
    );
  });

  it("shows Dashboard breadcrumb on /dashboard", () => {
    // Setup
    usePathnameMock.mockReturnValue("/dashboard");

    // Act
    render(
      <DashboardShell>
        <div>Content</div>
      </DashboardShell>,
    );

    // Assert
    expect(screen.getByTestId("breadcrumb-page")).toHaveTextContent(
      "Dashboard",
    );
  });

  it("shows Pipelines breadcrumb on /dashboard/pipelines", () => {
    // Setup
    usePathnameMock.mockReturnValue("/dashboard/pipelines");

    // Act
    render(
      <DashboardShell>
        <div>Content</div>
      </DashboardShell>,
    );

    // Assert
    expect(screen.getByTestId("breadcrumb-page")).toHaveTextContent(
      "Pipelines",
    );
  });

  it("shows Tickers breadcrumb on /dashboard/tickers", () => {
    // Setup
    usePathnameMock.mockReturnValue("/dashboard/tickers");

    // Act
    render(
      <DashboardShell>
        <div>Content</div>
      </DashboardShell>,
    );

    // Assert
    expect(screen.getByTestId("breadcrumb-page")).toHaveTextContent("Tickers");
  });

  it("shows Agents breadcrumb on /dashboard/agents", () => {
    // Setup
    usePathnameMock.mockReturnValue("/dashboard/agents");

    // Act
    render(
      <DashboardShell>
        <div>Content</div>
      </DashboardShell>,
    );

    // Assert
    expect(screen.getByTestId("breadcrumb-page")).toHaveTextContent("Agents");
  });

  it("shows Schedules breadcrumb on /dashboard/schedules", () => {
    // Setup
    usePathnameMock.mockReturnValue("/dashboard/schedules");

    // Act
    render(
      <DashboardShell>
        <div>Content</div>
      </DashboardShell>,
    );

    // Assert
    expect(screen.getByTestId("breadcrumb-page")).toHaveTextContent(
      "Schedules",
    );
  });

  it("shows Pipeline breadcrumb for UUID sub-route", () => {
    // Setup
    usePathnameMock.mockReturnValue(
      "/dashboard/pipelines/550e8400-e29b-41d4-a716-446655440000",
    );

    // Act
    render(
      <DashboardShell>
        <div>Content</div>
      </DashboardShell>,
    );

    // Assert
    expect(screen.getByTestId("breadcrumb-page")).toHaveTextContent("Pipeline");
  });

  it("shows Ticker breadcrumb for UUID sub-route", () => {
    // Setup
    usePathnameMock.mockReturnValue(
      "/dashboard/tickers/550e8400-e29b-41d4-a716-446655440000",
    );

    // Act
    render(
      <DashboardShell>
        <div>Content</div>
      </DashboardShell>,
    );

    // Assert
    expect(screen.getByTestId("breadcrumb-page")).toHaveTextContent("Ticker");
  });

  it("shows New ticker breadcrumb for /dashboard/tickers/new", () => {
    // Setup
    usePathnameMock.mockReturnValue("/dashboard/tickers/new");

    // Act
    render(
      <DashboardShell>
        <div>Content</div>
      </DashboardShell>,
    );

    // Assert
    expect(screen.getByTestId("breadcrumb-page")).toHaveTextContent(
      "New ticker",
    );
  });

  it("shows sidebar trigger button", () => {
    // Setup
    usePathnameMock.mockReturnValue("/dashboard");

    // Act
    render(
      <DashboardShell>
        <div>Content</div>
      </DashboardShell>,
    );

    // Assert
    expect(screen.getByTestId("sidebar-trigger")).toBeInTheDocument();
  });

  it("handles null user gracefully", () => {
    // Setup
    usePathnameMock.mockReturnValue("/dashboard");

    // Act
    render(
      <DashboardShell user={null}>
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
