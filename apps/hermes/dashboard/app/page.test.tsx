import { afterEach, describe, expect, it, vi } from "vitest";

const cookiesMock = vi.fn();
const redirectMock = vi.fn();

vi.mock("next/headers", () => ({
  cookies: () => cookiesMock(),
}));

vi.mock("next/navigation", () => ({
  redirect: (...args: [string]) => redirectMock(...args),
}));

describe("Page (root)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    cookiesMock.mockReset();
    redirectMock.mockReset();
  });

  it("redirects to /login when auth-token cookie is missing", async () => {
    cookiesMock.mockResolvedValue({
      get: () => undefined,
    });
    redirectMock.mockImplementation(() => {
      throw new Error("REDIRECT");
    });

    const Page = (await import("./page")).default;

    await expect(Page()).rejects.toThrow("REDIRECT");
    expect(redirectMock).toHaveBeenCalledWith("/login");
  });

  it("redirects to /dashboard when auth-token cookie is non-empty", async () => {
    cookiesMock.mockResolvedValue({
      get: (name: string) =>
        name === "auth-token" ? { value: "session-token" } : undefined,
    });
    redirectMock.mockImplementation(() => {
      throw new Error("REDIRECT");
    });

    const Page = (await import("./page")).default;

    await expect(Page()).rejects.toThrow("REDIRECT");
    expect(redirectMock).toHaveBeenCalledWith("/dashboard");
  });

  it("redirects to /login when auth-token is whitespace only", async () => {
    cookiesMock.mockResolvedValue({
      get: (name: string) =>
        name === "auth-token" ? { value: "   " } : undefined,
    });
    redirectMock.mockImplementation(() => {
      throw new Error("REDIRECT");
    });

    const Page = (await import("./page")).default;

    await expect(Page()).rejects.toThrow("REDIRECT");
    expect(redirectMock).toHaveBeenCalledWith("/login");
  });
});
