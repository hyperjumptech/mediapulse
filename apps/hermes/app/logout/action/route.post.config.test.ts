/** @vitest-environment node */
import { afterEach, describe, expect, it, vi, type Mock } from "vitest";
import {
  createClearAdminSession,
  createLogoutHandler,
  createSessionClearCookieOptions,
  handler,
} from "./route.post.config";

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

/**
 * Returns the mocked next cookies function.
 *
 * @returns The mocked cookies function.
 */
const getCookiesMock = async () => {
  const mod = await import("next/headers");
  return mod.cookies as unknown as Mock;
};

describe("createClearAdminSession", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("clears auth-token cookie with clear-cookie defaults", async () => {
    // Setup
    const setCookie = vi.fn();
    const clearAdminSession = createClearAdminSession({
      getCookieStore: async () => ({
        set: setCookie,
      }),
    });

    // Act
    await clearAdminSession();

    // Assert
    const clearOpts = createSessionClearCookieOptions();
    expect(setCookie).toHaveBeenCalledWith("auth-token", "", clearOpts);
    expect(setCookie).toHaveBeenCalledWith("auth-user", "", clearOpts);
  });
});

describe("createLogoutHandler", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("clears session and returns login redirect target", async () => {
    // Setup
    const clearSession = vi.fn();
    const logoutHandler = createLogoutHandler({
      clearAdminSession: clearSession,
    });

    // Act
    const result = await logoutHandler({
      body: {},
      params: {},
      headers: new Headers(),
      searchParams: {},
      user: undefined,
    } as never);

    // Assert
    expect(clearSession).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      status: true,
      data: {
        redirectTo: "/login",
      },
    });
  });
});

describe("handler", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("uses next cookies and returns success response", async () => {
    // Setup
    const cookiesMock = await getCookiesMock();
    const setCookieMock = vi.fn();
    cookiesMock.mockResolvedValue({
      set: setCookieMock,
    });

    // Act
    const result = await handler({
      body: {},
      params: {},
      headers: new Headers(),
      searchParams: {},
      user: undefined,
    } as never);

    // Assert
    const clearOpts = createSessionClearCookieOptions();
    expect(setCookieMock).toHaveBeenCalledWith("auth-token", "", clearOpts);
    expect(setCookieMock).toHaveBeenCalledWith("auth-user", "", clearOpts);
    expect(result).toMatchObject({
      status: true,
      data: {
        redirectTo: "/login",
      },
    });
  });
});
