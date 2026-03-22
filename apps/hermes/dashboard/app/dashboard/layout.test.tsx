import React from "react";
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getDashboardSessionMock = vi.fn();

const { getActiveDomainIntegrationsMock } = vi.hoisted(() => ({
  getActiveDomainIntegrationsMock: vi.fn(),
}));

vi.mock("@/lib/auth-dashboard", () => ({
  getDashboardSession: () => getDashboardSessionMock(),
}));

vi.mock("@/lib/domain-integrations", () => ({
  getActiveDomainIntegrations: () => getActiveDomainIntegrationsMock(),
}));

vi.mock("@/components/dashboard-shell", () => ({
  DashboardShell: ({
    children,
    user,
  }: {
    children: React.ReactNode;
    user?: { name: string; email: string } | null;
    domainIntegrations?: unknown;
  }) => (
    <div data-testid="dashboard-shell" data-user={user?.name ?? "none"}>
      {children}
    </div>
  ),
}));

describe("DashboardLayout", () => {
  beforeEach(() => {
    getActiveDomainIntegrationsMock.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    getDashboardSessionMock.mockReset();
    getActiveDomainIntegrationsMock.mockReset();
    getActiveDomainIntegrationsMock.mockResolvedValue([]);
  });

  it("renders children inside DashboardShell", async () => {
    // Setup
    getDashboardSessionMock.mockResolvedValue(null);
    const DashboardLayout = (await import("./layout")).default;

    // Act
    const component = await DashboardLayout({
      children: <div data-testid="child-content">Child Content</div>,
    });
    render(component);

    // Assert
    expect(screen.getByTestId("dashboard-shell")).toBeInTheDocument();
    expect(screen.getByTestId("child-content")).toBeInTheDocument();
  });

  it("passes user to DashboardShell when session exists", async () => {
    // Setup
    const user = { name: "Test User", email: "test@example.com" };
    getDashboardSessionMock.mockResolvedValue(user);
    const DashboardLayout = (await import("./layout")).default;

    // Act
    const component = await DashboardLayout({
      children: <div>Content</div>,
    });
    render(component);

    // Assert
    expect(screen.getByTestId("dashboard-shell")).toHaveAttribute(
      "data-user",
      "Test User",
    );
  });

  it("passes null user when no session", async () => {
    // Setup
    getDashboardSessionMock.mockResolvedValue(null);
    const DashboardLayout = (await import("./layout")).default;

    // Act
    const component = await DashboardLayout({
      children: <div>Content</div>,
    });
    render(component);

    // Assert
    expect(screen.getByTestId("dashboard-shell")).toHaveAttribute(
      "data-user",
      "none",
    );
  });
});
