import React from "react";
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getDashboardSessionMock = vi.fn();
const getDashboardAdminMock = vi.fn();
const getActiveDomainIntegrationsMock = vi.fn();
const mergeNavViewsMock = vi.fn();
const redirectMock = vi.fn((path: string) => {
  throw new Error(`NEXT_REDIRECT:${path}`);
});

const cookieValues = new Map<string, string>();

let capturedIntegrations: Promise<unknown> | undefined;
let capturedDefaultOpen: boolean | undefined;

vi.mock("next/navigation", () => ({
  redirect: (path: string) => redirectMock(path),
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => {
      const value = cookieValues.get(name);

      return value === undefined ? undefined : { name, value };
    },
  }),
}));

vi.mock("@/lib/date-time/viewer-date-time", () => ({
  getViewerDateTimeContext: async () => ({
    timeZone: "UTC",
    renderedAt: Date.parse("2026-09-28T12:00:00.000Z"),
  }),
}));

vi.mock("@/components/date-time/date-time-provider", () => ({
  DateTimeProvider: ({ children }: React.PropsWithChildren) => children,
}));

vi.mock("@/lib/auth-dashboard", () => ({
  getDashboardSession: () => getDashboardSessionMock(),
  HERMES_DASHBOARD_CLEAR_SESSION_PATH: "/clear-hermes-dashboard-session",
}));

vi.mock("@/lib/require-dashboard-admin", () => ({
  getDashboardAdmin: () => getDashboardAdminMock(),
}));

vi.mock("@/lib/domain-integrations", () => ({
  getActiveDomainIntegrationsCached: () => getActiveDomainIntegrationsMock(),
}));

vi.mock("@/lib/merge-domain-integration-nav-pages", () => ({
  mergeDomainIntegrationNavViews: (integration: unknown) =>
    mergeNavViewsMock(integration),
}));

vi.mock("@/components/dashboard-shell", () => ({
  DashboardShell: ({
    children,
    user,
    domainIntegrations,
    defaultOpen,
  }: {
    children: React.ReactNode;
    user?: { name: string; email: string } | null;
    domainIntegrations: Promise<unknown>;
    defaultOpen?: boolean;
  }) => {
    capturedIntegrations = domainIntegrations;
    capturedDefaultOpen = defaultOpen;

    return (
      <div data-testid="dashboard-shell" data-user={user?.name ?? "none"}>
        {children}
      </div>
    );
  },
}));

import DashboardLayout from "./layout";

const sessionUser = {
  id: "u1",
  name: "Admin",
  email: "a@b.com",
  credentialVersion: 0,
};

const renderLayout = async () => {
  render(
    await DashboardLayout({
      children: <div data-testid="child-content">Child Content</div>,
    }),
  );
};

describe("DashboardLayout", () => {
  beforeEach(() => {
    capturedIntegrations = undefined;
    capturedDefaultOpen = undefined;
    cookieValues.clear();
    getDashboardSessionMock.mockResolvedValue(sessionUser);
    getDashboardAdminMock.mockResolvedValue(sessionUser);
    getActiveDomainIntegrationsMock.mockResolvedValue([]);
    mergeNavViewsMock.mockReturnValue([]);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders children inside DashboardShell with the session user", async () => {
    // Act
    await renderLayout();

    // Assert
    expect(screen.getByTestId("dashboard-shell")).toHaveAttribute(
      "data-user",
      "Admin",
    );
    expect(screen.getByTestId("child-content")).toBeInTheDocument();
  });

  it("does not wait for the database before rendering the shell", async () => {
    // Setup
    getDashboardAdminMock.mockReturnValue(new Promise(() => {}));

    // Act
    await renderLayout();

    // Assert
    expect(screen.getByTestId("dashboard-shell")).toBeInTheDocument();
    expect(getActiveDomainIntegrationsMock).not.toHaveBeenCalled();
  });

  it("streams the integration nav for an active admin", async () => {
    // Setup
    getActiveDomainIntegrationsMock.mockResolvedValue([
      { integrationId: "mediapulse", name: "Mediapulse" },
    ]);
    mergeNavViewsMock.mockReturnValue([{ id: "tickers" }]);

    // Act
    await renderLayout();

    // Assert
    await expect(capturedIntegrations).resolves.toEqual([
      {
        integrationId: "mediapulse",
        name: "Mediapulse",
        views: [{ id: "tickers" }],
      },
    ]);
  });

  it("streams an empty nav when the admin check fails", async () => {
    // Setup
    getDashboardAdminMock.mockResolvedValue(null);

    // Act
    await renderLayout();

    // Assert
    await expect(capturedIntegrations).resolves.toEqual([]);
    expect(getActiveDomainIntegrationsMock).not.toHaveBeenCalled();
  });

  it("streams an empty nav when loading integrations fails", async () => {
    // Setup
    getActiveDomainIntegrationsMock.mockRejectedValue(new Error("db down"));

    // Act
    await renderLayout();

    // Assert
    await expect(capturedIntegrations).resolves.toEqual([]);
  });

  it("opens the sidebar when no sidebar state cookie is set", async () => {
    // Act
    await renderLayout();

    // Assert
    expect(capturedDefaultOpen).toBe(true);
  });

  it("opens the sidebar when the sidebar state cookie is true", async () => {
    // Setup
    cookieValues.set("sidebar_state", "true");

    // Act
    await renderLayout();

    // Assert
    expect(capturedDefaultOpen).toBe(true);
  });

  it("collapses the sidebar when the sidebar state cookie is false", async () => {
    // Setup
    cookieValues.set("sidebar_state", "false");

    // Act
    await renderLayout();

    // Assert
    expect(capturedDefaultOpen).toBe(false);
  });

  it("redirects to the clear-session route without a valid session", async () => {
    // Setup
    getDashboardSessionMock.mockResolvedValue(null);

    // Act & Assert
    await expect(renderLayout()).rejects.toThrow(
      "NEXT_REDIRECT:/clear-hermes-dashboard-session",
    );
  });
});
