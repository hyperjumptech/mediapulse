/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";
import { getDashboardSession } from "./auth-dashboard";

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
            ? { value: '{"name":"Admin","email":"admin@example.com"}' }
            : undefined,
    });

    const result = await getDashboardSession({ getCookieStore });

    expect(result).toEqual({ name: "Admin", email: "admin@example.com" });
  });

  it("returns user from Cookie header when cookie store has no auth cookies (e.g. Server Action)", async () => {
    const getCookieStore = vi.fn().mockResolvedValue({
      get: () => undefined,
    });
    const cookieHeader =
      "auth-token=session-123; auth-user=" +
      encodeURIComponent('{"name":"Admin","email":"admin@example.com"}');
    const getHeaders = vi
      .fn()
      .mockResolvedValue(new Headers({ cookie: cookieHeader }));

    const result = await getDashboardSession({
      getCookieStore,
      getHeaders,
    });

    expect(result).toEqual({ name: "Admin", email: "admin@example.com" });
  });
});
