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
  getDashboardSessionFromRequest,
  parseDashboardUserFromAuthCookie,
  requireDashboardPrincipalForRoute,
  requireDashboardSessionForRoute,
  resolveDashboardPrincipal,
  resolveHermesActiveAdminDashboardAccess,
} from "./auth-dashboard";

vi.mock("@/lib/mcp-api-keys", () => ({
  validateApiKey: vi.fn(),
  touchMcpApiKeyLastUsed: vi.fn(),
}));

vi.mock("@hermes/orchestration-database", () => ({
  UserRole: { ADMIN: "ADMIN", USER: "USER" },
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

describe("parseDashboardUserFromAuthCookie", () => {
  it("returns null for invalid JSON", () => {
    expect(parseDashboardUserFromAuthCookie("not-json")).toBeNull();
  });

  it("returns null when id name email are not strings", () => {
    expect(parseDashboardUserFromAuthCookie("{}")).toBeNull();
  });

  it("defaults credentialVersion to 0 when omitted", () => {
    expect(
      parseDashboardUserFromAuthCookie(
        '{"id":"u1","name":"A","email":"a@b.com"}',
      ),
    ).toEqual({
      id: "u1",
      name: "A",
      email: "a@b.com",
      credentialVersion: 0,
    });
  });

  it("reads integer credentialVersion when present", () => {
    expect(
      parseDashboardUserFromAuthCookie(
        '{"id":"u1","name":"A","email":"a@b.com","credentialVersion":3}',
      ),
    ).toEqual({
      id: "u1",
      name: "A",
      email: "a@b.com",
      credentialVersion: 3,
    });
  });

  it("ignores non-integer credentialVersion", () => {
    expect(
      parseDashboardUserFromAuthCookie(
        '{"id":"u1","name":"A","email":"a@b.com","credentialVersion":1.5}',
      ),
    ).toEqual({
      id: "u1",
      name: "A",
      email: "a@b.com",
      credentialVersion: 0,
    });
  });
});

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
      credentialVersion: 0,
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
      credentialVersion: 0,
    });
  });
});

describe("requireDashboardSessionForRoute", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("throws Unauthorized when auth cookies are missing", async () => {
    const { cookies } = await import("next/headers");
    vi.mocked(cookies).mockResolvedValue({
      get: () => undefined,
    } as never);
    await expect(requireDashboardSessionForRoute()).rejects.toThrow(
      "Unauthorized",
    );
  });

  it("throws when credentialVersion does not match database", async () => {
    const { cookies } = await import("next/headers");
    vi.mocked(cookies).mockResolvedValue({
      get: (name: string) =>
        name === "auth-token"
          ? { value: "t" }
          : name === "auth-user"
            ? {
                value: JSON.stringify({
                  id: "u1",
                  name: "A",
                  email: "a@b.com",
                  credentialVersion: 0,
                }),
              }
            : undefined,
    } as never);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      role: "ADMIN",
      isActive: true,
      credentialVersion: 1,
    } as never);
    await expect(requireDashboardSessionForRoute()).rejects.toThrow(
      "Unauthorized",
    );
  });

  it("returns session when credentialVersion matches active admin", async () => {
    const { cookies } = await import("next/headers");
    const sessionPayload = {
      id: "u1",
      name: "A",
      email: "a@b.com",
      credentialVersion: 2,
    };
    vi.mocked(cookies).mockResolvedValue({
      get: (name: string) =>
        name === "auth-token"
          ? { value: "t" }
          : name === "auth-user"
            ? { value: JSON.stringify(sessionPayload) }
            : undefined,
    } as never);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      role: "ADMIN",
      isActive: true,
      credentialVersion: 2,
    } as never);
    await expect(requireDashboardSessionForRoute()).resolves.toEqual(
      sessionPayload,
    );
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
        credentialVersion: 0,
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
        credentialVersion: 0,
      }),
      findUserForDashboard: async () => ({
        role: "USER",
        isActive: true,
        credentialVersion: 0,
      }),
    });
    expect(result).toEqual({ ok: false });
  });

  it("returns ok false when credentialVersion mismatches", async () => {
    const result = await resolveHermesActiveAdminDashboardAccess({
      getSession: async () => ({
        id: "u1",
        name: "A",
        email: "a@b.com",
        credentialVersion: 0,
      }),
      findUserForDashboard: async () => ({
        role: "ADMIN",
        isActive: true,
        credentialVersion: 1,
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
        credentialVersion: 0,
      }),
      findUserForDashboard: async () => ({
        role: "ADMIN",
        isActive: true,
        credentialVersion: 0,
      }),
    });
    expect(result).toEqual({ ok: true });
  });

  it("uses prisma when default findUser is used", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      role: "ADMIN",
      isActive: true,
      credentialVersion: 0,
    } as never);
    const result = await resolveHermesActiveAdminDashboardAccess({
      getSession: async () => ({
        id: "u1",
        name: "A",
        email: "a@b.com",
        credentialVersion: 0,
      }),
    });
    expect(result).toEqual({ ok: true });
    expect(prisma.user.findUnique).toHaveBeenCalled();
  });
});

describe("getDashboardSessionFromRequest", () => {
  it("parses auth cookies from request", () => {
    const user = JSON.stringify({
      id: "u1",
      name: "A",
      email: "a@b.com",
      credentialVersion: 0,
    });
    const req = new Request("http://localhost", {
      headers: {
        cookie: `auth-token=tok; auth-user=${encodeURIComponent(user)}`,
      },
    });
    expect(getDashboardSessionFromRequest(req)).toEqual({
      id: "u1",
      name: "A",
      email: "a@b.com",
      credentialVersion: 0,
    });
  });
});

describe("resolveDashboardPrincipal", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns api_key principal and touches last used", async () => {
    const { validateApiKey, touchMcpApiKeyLastUsed } =
      await import("@/lib/mcp-api-keys");
    vi.mocked(validateApiKey).mockResolvedValue({
      id: "key-1",
      label: "Cursor",
      readOnly: true,
      createdByUserId: "u1",
    });
    vi.mocked(touchMcpApiKeyLastUsed).mockResolvedValue(undefined);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      role: "ADMIN",
      isActive: true,
      credentialVersion: 0,
      name: "Admin",
      email: "a@b.com",
    } as never);

    const req = new Request("http://localhost", {
      headers: { Authorization: "Bearer hmcp_x_y" },
    });
    const principal = await resolveDashboardPrincipal(req);
    expect(principal).toEqual({
      authMethod: "api_key",
      user: {
        id: "u1",
        name: "Admin",
        email: "a@b.com",
        credentialVersion: 0,
      },
      apiKeyId: "key-1",
      readOnly: true,
      label: "Cursor",
    });
    expect(touchMcpApiKeyLastUsed).toHaveBeenCalledWith("key-1");
  });

  it("returns session principal from cookies", async () => {
    const { validateApiKey } = await import("@/lib/mcp-api-keys");
    vi.mocked(validateApiKey).mockResolvedValue(null);
    const user = JSON.stringify({
      id: "u1",
      name: "A",
      email: "a@b.com",
      credentialVersion: 0,
    });
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      role: "ADMIN",
      isActive: true,
      credentialVersion: 0,
    } as never);
    const req = new Request("http://localhost", {
      headers: {
        cookie: `auth-token=t; auth-user=${encodeURIComponent(user)}`,
      },
    });
    const principal = await resolveDashboardPrincipal(req);
    expect(principal?.authMethod).toBe("session");
  });
});

describe("requireDashboardPrincipalForRoute", () => {
  it("throws when unauthenticated", async () => {
    await expect(requireDashboardPrincipalForRoute()).rejects.toThrow(
      "Unauthorized",
    );
  });
});
