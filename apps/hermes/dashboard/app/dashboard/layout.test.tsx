import React from "react";
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getDashboardSessionMock = vi.fn();
const resolveAccessMock = vi.fn();

const { getActiveDomainIntegrationsMock } = vi.hoisted(() => ({
  getActiveDomainIntegrationsMock: vi.fn(),
}));

const { redirectMock } = vi.hoisted(() => ({
  redirectMock: vi.fn((path: string) => {
    void path;
    throw new Error("NEXT_REDIRECT");
  }),
}));

vi.mock("@hermes/env", () => ({
  env: {
    ORCHESTRATION_DATABASE_URL: "postgresql://test:test@localhost:5432/test",
    TEMP_ADMIN_USERNAME: "test",
    TEMP_ADMIN_PASSWORD: "testtest",
    HERMES_INTERNAL_API_KEY: "test-key",
    AGENT_DATA_API_URL: "http://test-agent-data-api",
    HERMES_CGA_DIAGNOSTICS_ENABLED: "true",
  },
}));

vi.mock("next/navigation", () => ({
  redirect: (path: string) => redirectMock(path),
}));

vi.mock("@/lib/auth-dashboard", () => ({
  getDashboardSession: () => getDashboardSessionMock(),
  resolveHermesActiveAdminDashboardAccess: () => resolveAccessMock(),
  HERMES_DASHBOARD_CLEAR_SESSION_PATH: "/clear-hermes-dashboard-session",
}));

vi.mock("@/lib/domain-integrations", () => ({
  getActiveDomainIntegrations: () => getActiveDomainIntegrationsMock(),
}));

vi.mock("@/components/dashboard-shell", () => ({
  DashboardShell: ({
    children,
    user,
    showCgaDiagnostics,
  }: {
    children: React.ReactNode;
    user?: { name: string; email: string } | null;
    domainIntegrations?: unknown;
    showCgaDiagnostics?: boolean;
  }) => (
    <div
      data-testid="dashboard-shell"
      data-user={user?.name ?? "none"}
      data-show-cga-diagnostics={String(showCgaDiagnostics)}
    >
      {children}
    </div>
  ),
}));

describe("DashboardLayout", () => {
  beforeEach(() => {
    getActiveDomainIntegrationsMock.mockResolvedValue([]);
    resolveAccessMock.mockResolvedValue({ ok: true });
    redirectMock.mockImplementation((path: string) => {
      void path;
      throw new Error("NEXT_REDIRECT");
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    getDashboardSessionMock.mockReset();
    resolveAccessMock.mockReset();
    redirectMock.mockReset();
    redirectMock.mockImplementation((path: string) => {
      void path;
      throw new Error("NEXT_REDIRECT");
    });
    getActiveDomainIntegrationsMock.mockReset();
    getActiveDomainIntegrationsMock.mockResolvedValue([]);
  });

  it("renders children inside DashboardShell when access is allowed", async () => {
    getDashboardSessionMock.mockResolvedValue({
      id: "u1",
      name: "Admin",
      email: "a@b.com",
    });
    const DashboardLayout = (await import("./layout")).default;

    const component = await DashboardLayout({
      children: <div data-testid="child-content">Child Content</div>,
    });
    render(component);

    expect(screen.getByTestId("dashboard-shell")).toBeInTheDocument();
    expect(screen.getByTestId("child-content")).toBeInTheDocument();
  });

  it("passes user to DashboardShell when session exists", async () => {
    const user = {
      id: "u1",
      name: "Test User",
      email: "test@example.com",
    };
    getDashboardSessionMock.mockResolvedValue(user);
    const DashboardLayout = (await import("./layout")).default;

    const component = await DashboardLayout({
      children: <div>Content</div>,
    });
    render(component);

    expect(screen.getByTestId("dashboard-shell")).toHaveAttribute(
      "data-user",
      "Test User",
    );
  });

  it("passes showCgaDiagnostics to DashboardShell based on env flag", async () => {
    getDashboardSessionMock.mockResolvedValue({
      id: "u1",
      name: "Admin",
      email: "a@b.com",
    });
    const DashboardLayout = (await import("./layout")).default;

    const component = await DashboardLayout({
      children: <div>Content</div>,
    });
    render(component);

    expect(screen.getByTestId("dashboard-shell")).toHaveAttribute(
      "data-show-cga-diagnostics",
      "true",
    );
  });
  it("redirects to clear-session route when access is denied", async () => {
    resolveAccessMock.mockResolvedValue({ ok: false });
    getDashboardSessionMock.mockResolvedValue(null);
    const DashboardLayout = (await import("./layout")).default;

    await expect(
      DashboardLayout({
        children: <div>Content</div>,
      }),
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(redirectMock).toHaveBeenCalledWith(
      "/clear-hermes-dashboard-session",
    );
  });
});
