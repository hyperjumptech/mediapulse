/** @vitest-environment node */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getDashboardSessionMock = vi.fn();
const resolveAccessMock = vi.fn();
const redirectMock = vi.fn((path: string) => {
  throw new Error(`NEXT_REDIRECT:${path}`);
});

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();

  return {
    ...actual,
    cache: <Callback>(callback: Callback) => callback,
  };
});

vi.mock("next/navigation", () => ({
  redirect: (path: string) => redirectMock(path),
}));

vi.mock("@/lib/auth-dashboard", () => ({
  HERMES_DASHBOARD_CLEAR_SESSION_PATH: "/clear-hermes-dashboard-session",
  getDashboardSession: () => getDashboardSessionMock(),
  resolveHermesActiveAdminDashboardAccess: (...args: unknown[]) =>
    resolveAccessMock(...args),
}));

import {
  getDashboardAdmin,
  requireDashboardAdmin,
  withDashboardAdmin,
} from "./require-dashboard-admin";

const sessionUser = {
  id: "user-1",
  name: "Admin",
  email: "admin@example.com",
  credentialVersion: 0,
};

describe("require-dashboard-admin", () => {
  beforeEach(() => {
    getDashboardSessionMock.mockResolvedValue(sessionUser);
    resolveAccessMock.mockResolvedValue({ ok: true });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("getDashboardAdmin", () => {
    it("returns the session user for an active admin", async () => {
      await expect(getDashboardAdmin()).resolves.toEqual(sessionUser);
    });

    it("checks the database against the session it already read", async () => {
      // Act
      await getDashboardAdmin();

      // Assert
      const [dependencies] = resolveAccessMock.mock.calls[0] as [
        { getSession: () => Promise<unknown> },
      ];

      await expect(dependencies.getSession()).resolves.toEqual(sessionUser);
      expect(getDashboardSessionMock).toHaveBeenCalledTimes(1);
    });

    it("returns null without a session and skips the database", async () => {
      // Setup
      getDashboardSessionMock.mockResolvedValue(null);

      // Act
      const admin = await getDashboardAdmin();

      // Assert
      expect(admin).toBeNull();
      expect(resolveAccessMock).not.toHaveBeenCalled();
    });

    it("returns null when the admin was disabled or rotated credentials", async () => {
      // Setup
      resolveAccessMock.mockResolvedValue({ ok: false });

      // Act & Assert
      await expect(getDashboardAdmin()).resolves.toBeNull();
    });
  });

  describe("requireDashboardAdmin", () => {
    it("returns the admin", async () => {
      await expect(requireDashboardAdmin()).resolves.toEqual(sessionUser);
    });

    it("redirects to the clear-session route when access is denied", async () => {
      // Setup
      resolveAccessMock.mockResolvedValue({ ok: false });

      // Act & Assert
      await expect(requireDashboardAdmin()).rejects.toThrow(
        "NEXT_REDIRECT:/clear-hermes-dashboard-session",
      );
    });
  });

  describe("withDashboardAdmin", () => {
    it("resolves with the loaded value when authorized", async () => {
      await expect(withDashboardAdmin(Promise.resolve(42))).resolves.toBe(42);
    });

    it("lets the auth redirect win over a failing load", async () => {
      // Setup
      resolveAccessMock.mockResolvedValue({ ok: false });
      const failingLoad = Promise.reject(new Error("load failed"));

      // Act & Assert
      await expect(withDashboardAdmin(failingLoad)).rejects.toThrow(
        "NEXT_REDIRECT:/clear-hermes-dashboard-session",
      );
    });

    it("rethrows the load error when authorized", async () => {
      // Setup
      const failingLoad = Promise.reject(new Error("load failed"));

      // Act & Assert
      await expect(withDashboardAdmin(failingLoad)).rejects.toThrow(
        "load failed",
      );
    });
  });
});
