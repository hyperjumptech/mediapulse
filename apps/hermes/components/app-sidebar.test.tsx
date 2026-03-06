import React from "react";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppSidebar } from "./app-sidebar";

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
  SidebarMenu: ({ children }: React.PropsWithChildren) => (
    <nav data-testid="sidebar-menu">{children}</nav>
  ),
  SidebarMenuItem: ({ children }: React.PropsWithChildren) => (
    <div data-testid="sidebar-menu-item">{children}</div>
  ),
  SidebarMenuButton: ({
    children,
    asChild,
    isActive,
  }: React.PropsWithChildren<{ asChild?: boolean; isActive?: boolean }>) => (
    <div data-testid="sidebar-menu-button" data-active={isActive}>
      {children}
    </div>
  ),
}));

vi.mock("@workspace/ui/components/separator", () => ({
  Separator: ({ className }: { className?: string }) => (
    <hr data-testid="separator" className={className} />
  ),
}));

describe("AppSidebar", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    usePathnameMock.mockReset();
  });

  it("renders the Hermes logo text", () => {
    // Setup
    usePathnameMock.mockReturnValue("/dashboard");

    // Act
    render(<AppSidebar />);

    // Assert
    expect(screen.getByText("Hermes")).toBeInTheDocument();
  });

  it("renders all navigation items", () => {
    // Setup
    usePathnameMock.mockReturnValue("/dashboard");

    // Act
    render(<AppSidebar />);

    // Assert
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Pipelines")).toBeInTheDocument();
    expect(screen.getByText("Tickers")).toBeInTheDocument();
    expect(screen.getByText("Agents")).toBeInTheDocument();
    expect(screen.getByText("Schedules")).toBeInTheDocument();
  });

  it("marks Dashboard as active when on /dashboard", () => {
    // Setup
    usePathnameMock.mockReturnValue("/dashboard");

    // Act
    render(<AppSidebar />);

    // Assert
    const buttons = screen.getAllByTestId("sidebar-menu-button");
    const dashboardButton = buttons.find((btn) =>
      btn.textContent?.includes("Dashboard"),
    );
    expect(dashboardButton).toHaveAttribute("data-active", "true");
  });

  it("marks Tickers as active when on /dashboard/tickers", () => {
    // Setup
    usePathnameMock.mockReturnValue("/dashboard/tickers");

    // Act
    render(<AppSidebar />);

    // Assert
    const buttons = screen.getAllByTestId("sidebar-menu-button");
    const tickersButton = buttons.find((btn) =>
      btn.textContent?.includes("Tickers"),
    );
    expect(tickersButton).toHaveAttribute("data-active", "true");
  });

  it("marks Agents as active when on /dashboard/agents", () => {
    // Setup
    usePathnameMock.mockReturnValue("/dashboard/agents");

    // Act
    render(<AppSidebar />);

    // Assert
    const buttons = screen.getAllByTestId("sidebar-menu-button");
    const agentsButton = buttons.find((btn) =>
      btn.textContent?.includes("Agents"),
    );
    expect(agentsButton).toHaveAttribute("data-active", "true");
  });

  it("marks Schedules as active when on /dashboard/schedules", () => {
    // Setup
    usePathnameMock.mockReturnValue("/dashboard/schedules");

    // Act
    render(<AppSidebar />);

    // Assert
    const buttons = screen.getAllByTestId("sidebar-menu-button");
    const schedulesButton = buttons.find((btn) =>
      btn.textContent?.includes("Schedules"),
    );
    expect(schedulesButton).toHaveAttribute("data-active", "true");
  });

  it("displays user name and email when user prop provided", () => {
    // Setup
    usePathnameMock.mockReturnValue("/dashboard");
    const user = { name: "John Doe", email: "john@example.com" };

    // Act
    render(<AppSidebar user={user} />);

    // Assert
    expect(screen.getByText("John Doe")).toBeInTheDocument();
    expect(screen.getByText("john@example.com")).toBeInTheDocument();
  });

  it("renders logout form without user info when no user provided", () => {
    // Setup
    usePathnameMock.mockReturnValue("/dashboard");

    // Act
    render(<AppSidebar />);

    // Assert
    expect(screen.getByTestId("logout-form")).toBeInTheDocument();
    expect(screen.queryByText("John Doe")).not.toBeInTheDocument();
  });

  it("renders logout form when user is null", () => {
    // Setup
    usePathnameMock.mockReturnValue("/dashboard");

    // Act
    render(<AppSidebar user={null} />);

    // Assert
    expect(screen.getByTestId("logout-form")).toBeInTheDocument();
  });
});
