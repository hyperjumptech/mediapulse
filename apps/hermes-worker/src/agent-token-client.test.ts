/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";
import { createAgentTokenClient } from "./agent-token-client";

describe("createAgentTokenClient", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns token from API and caches it", async () => {
    const fetchFn = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ token: "eyJ.test.token", expiresIn: 900 }),
    });
    const client = createAgentTokenClient({
      authApiUrl: "https://auth.example.com",
      credential: "scheduler-key",
      fetchFn,
    });

    const token1 = await client.getToken();
    const token2 = await client.getToken();

    expect(token1).toBe("eyJ.test.token");
    expect(token2).toBe("eyJ.test.token");
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(fetchFn).toHaveBeenCalledWith(
      "https://auth.example.com/api/token",
      expect.objectContaining({
        method: "POST",
        headers: {
          Authorization: "Bearer scheduler-key",
          "Content-Type": "application/json",
        },
      }),
    );
  });

  it("strips trailing slash from authApiUrl", async () => {
    const fetchFn = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ token: "t", expiresIn: 900 }),
    });
    const client = createAgentTokenClient({
      authApiUrl: "https://auth.example.com/",
      credential: "key",
      fetchFn,
    });
    await client.getToken();
    expect(fetchFn).toHaveBeenCalledWith(
      "https://auth.example.com/api/token",
      expect.any(Object),
    );
  });

  it("throws when API returns non-ok", async () => {
    const fetchFn = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 401,
      statusText: "Unauthorized",
      text: () => Promise.resolve("Invalid key"),
    });
    const client = createAgentTokenClient({
      authApiUrl: "https://auth.example.com",
      credential: "bad-key",
      fetchFn,
    });
    await expect(client.getToken()).rejects.toThrow(
      /Agent auth token request failed: 401/,
    );
  });

  it("throws when API response has no token", async () => {
    const fetchFn = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ expiresIn: 900 }),
    });
    const client = createAgentTokenClient({
      authApiUrl: "https://auth.example.com",
      credential: "key",
      fetchFn,
    });
    await expect(client.getToken()).rejects.toThrow(
      "Agent auth API did not return a token",
    );
  });
});
