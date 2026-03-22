/** @vitest-environment node */
import { prisma } from "@hermes/orchestration-database";
import type { NextResponse } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  applyClearHermesDashboardAuthCookies,
  createClearDashboardAuthCookies,
  createSessionClearCookieOptions,
  getCookieFromHeader,
  getDashboardSession,
  resolveHermesActiveAdminDashboardAccess,
} from "./auth-dashboard";

vi.mock("@hermes/orchestration-database", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
  headers: vi.fn().mockResolvedValue(new Headers()),
}));

describe("getDashboardSession", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns null when auth-token is missing", async () => {
    const getCookieStore = vi.fn().mockResolvedValue({
      get: (name: string) =>
        name === "auth-user"
          ? { value: '{"name":"A","email":"a@b.com"}' }
          : undefined,
    });

    const result = await getDashboardSession({ getCookieStore });

    expect(result).toBeNull();
  });

  it("returns null when auth-user is missing", async () => {
    const getCookieStore = vi.fn().mockResolvedValue({
      get: (name: string) =>
        name === "auth-token" ? { value: "token" } : undefined,
    });

    const result = await getDashboardSession({ getCookieStore });

    expect(result).toBeNull();
  });

  it("returns null when auth-user is invalid JSON", async () => {
    const getCookieStore = vi.fn().mockResolvedValue({
      get: (name: string) =>
        name === "auth-token"
          ? { value: "t" }
          : name === "auth-user"
            ? { value: "not-json" }
            : undefined,
    });

    const result = await getDashboardSession({ getCookieStore });

    expect(result).toBeNull();
  });

  it("returns null when auth-user lacks name or email", async () => {
    const getCookieStore = vi.fn().mockResolvedValue({
      get: (name: string) =>
        name === "auth-token"
          ? { value: "t" }
          : name === "auth-user"
            ? { value: '{"email":"a@b.com"}' }
            : undefined,
    });

    const result = await getDashboardSession({ getCookieStore });

    expect(result).toBeNull();
  });

  it("returns user when both cookies are valid", async () => {
    const getCookieStore = vi.fn().mockResolvedValue({
      get: (name: string) =>
        name === "auth-token"
          ? { value: "token" }
          : name === "auth-user"
            ? {
                value:
                  '{"id":"user-1","name":"Admin","email":"admin@example.com"}',
              }
            : undefined,
    });

    const result = await getDashboardSession({ getCookieStore });

    expect(result).toEqual({
      id: "user-1",
      name: "Admin",
      email: "admin@example.com",
    });
  });

  it("returns user from Cookie header when cookie store has no auth cookies (e.g. Server Action)", async () => {
    const getCookieStore = vi.fn().mockResolvedValue({
      get: () => undefined,
    });
    const cookieHeader =
      "auth-token=session-123; auth-user=" +
      encodeURIComponent(
        '{"id":"user-1","name":"Admin","email":"admin@example.com"}',
      );
    const getHeaders = vi
      .fn()
      .mockResolvedValue(new Headers({ cookie: cookieHeader }));

    const result = await getDashboardSession({
      getCookieStore,
      getHeaders,
    });

    expect(result).toEqual({
      id: "user-1",
      name: "Admin",
      email: "admin@example.com",
    });
  });
});

describe("getCookieFromHeader", () => {
  it("returns null for empty header", () => {
    expect(getCookieFromHeader(null, "a")).toBeNull();
  });

  it("returns decoded cookie value", () => {
    const v = getCookieFromHeader("a=hello%20world", "a");
    expect(v).toBe("hello world");
  });
});

describe("createSessionClearCookieOptions", () => {
  it("returns httpOnly lax path cookie options with maxAge 0", () => {
    expect(createSessionClearCookieOptions()).toEqual({
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
  });
});

describe("applyClearHermesDashboardAuthCookies", () => {
  it("sets empty auth-token and auth-user on the response", () => {
    const set = vi.fn();
    const response = { cookies: { set } } as unknown as NextResponse;
    applyClearHermesDashboardAuthCookies(response);
    const opts = createSessionClearCookieOptions();
    expect(set).toHaveBeenCalledWith("auth-token", "", opts);
    expect(set).toHaveBeenCalledWith("auth-user", "", opts);
  });
});

describe("createClearDashboardAuthCookies", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("clears auth-token and auth-user", async () => {
    const set = vi.fn();
    const clear = createClearDashboardAuthCookies({
      getCookieStore: async () => ({ set }),
    });
    await clear();
    const opts = createSessionClearCookieOptions();
    expect(set).toHaveBeenCalledWith("auth-token", "", opts);
    expect(set).toHaveBeenCalledWith("auth-user", "", opts);
  });
});

describe("resolveHermesActiveAdminDashboardAccess", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns ok false when session is null", async () => {
    const result = await resolveHermesActiveAdminDashboardAccess({
      getSession: async () => null,
      findUserForDashboard: vi.fn(),
    });
    expect(result).toEqual({ ok: false });
  });

  it("returns ok false when user is missing", async () => {
    const result = await resolveHermesActiveAdminDashboardAccess({
      getSession: async () => ({
        id: "u1",
        name: "A",
        email: "a@b.com",
      }),
      findUserForDashboard: async () => null,
    });
    expect(result).toEqual({ ok: false });
  });

  it("returns ok false when user is not admin or inactive", async () => {
    const result = await resolveHermesActiveAdminDashboardAccess({
      getSession: async () => ({
        id: "u1",
        name: "A",
        email: "a@b.com",
      }),
      findUserForDashboard: async () => ({
        role: "USER",
        isActive: true,
      }),
    });
    expect(result).toEqual({ ok: false });
  });

  it("returns ok true for active admin", async () => {
    const result = await resolveHermesActiveAdminDashboardAccess({
      getSession: async () => ({
        id: "u1",
        name: "A",
        email: "a@b.com",
      }),
      findUserForDashboard: async () => ({
        role: "ADMIN",
        isActive: true,
      }),
    });
    expect(result).toEqual({ ok: true });
  });

  it("uses prisma when default findUser is used", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      role: "ADMIN",
      isActive: true,
    } as never);
    const result = await resolveHermesActiveAdminDashboardAccess({
      getSession: async () => ({
        id: "u1",
        name: "A",
        email: "a@b.com",
      }),
    });
    expect(result).toEqual({ ok: true });
    expect(prisma.user.findUnique).toHaveBeenCalled();
  });
});
