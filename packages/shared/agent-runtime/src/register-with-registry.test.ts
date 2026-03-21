import { afterEach, describe, expect, it, vi } from "vitest";

const getToken = vi.fn().mockResolvedValue("minted-jwt-abc");

vi.mock("@workspace/agent-auth-client", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@workspace/agent-auth-client")>();
  return {
    ...actual,
    createAgentTokenClient: vi.fn(() => ({
      getToken,
    })),
  };
});

import { registerWithRegistry } from "./register-with-registry.js";

describe("registerWithRegistry", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("POSTs to registry with JWT from token client and correct body", async () => {
    const fetchFn = vi.fn().mockResolvedValue({ ok: true });
    await registerWithRegistry({
      registryUrl: "https://registry.example.com",
      authApiUrl: "https://auth.example.com",
      schedulerApiKey: "scheduler-secret",
      agentId: "my-agent",
      agentVersion: "1.0.0",
      agentUrl: "https://agent.example.com",
      inputSchema: { type: "object", properties: {} },
      configSchema: { type: "object" },
      description: "My agent",
      fetchFn,
    });

    expect(getToken).toHaveBeenCalledTimes(1);
    expect(fetchFn).toHaveBeenCalledTimes(1);
    const [url, options] = fetchFn.mock.calls[0] as [
      string,
      { method: string; headers: Record<string, string>; body: string },
    ];
    expect(url).toBe("https://registry.example.com/api/agents/register");
    expect(options.method).toBe("POST");
    expect(options.headers.Authorization).toBe("Bearer minted-jwt-abc");
    expect(options.headers["Content-Type"]).toBe("application/json");
    const body = JSON.parse(options.body);
    expect(body).toEqual({
      agentId: "my-agent",
      agentVersion: "1.0.0",
      endpoint: { url: "https://agent.example.com", method: "POST" },
      inputSchema: { type: "object", properties: {} },
      configSchema: { type: "object" },
      description: "My agent",
    });
  });

  it("strips trailing slash from registryUrl", async () => {
    const fetchFn = vi.fn().mockResolvedValue({ ok: true });
    await registerWithRegistry({
      registryUrl: "https://registry.example.com/",
      authApiUrl: "https://auth.example.com",
      schedulerApiKey: "key",
      agentId: "a",
      agentVersion: "1.0.0",
      agentUrl: "https://a.example.com",
      inputSchema: {},
      fetchFn,
    });
    expect(fetchFn).toHaveBeenCalledWith(
      "https://registry.example.com/api/agents/register",
      expect.any(Object),
    );
  });

  it("omits configSchema and description when not provided", async () => {
    const fetchFn = vi.fn().mockResolvedValue({ ok: true });
    await registerWithRegistry({
      registryUrl: "https://r.example.com",
      authApiUrl: "https://auth.example.com",
      schedulerApiKey: "k",
      agentId: "x",
      agentVersion: "2.0.0",
      agentUrl: "https://x.example.com",
      inputSchema: { type: "object" },
      fetchFn,
    });
    const body = JSON.parse(
      (fetchFn.mock.calls[0] as [string, { body: string }])[1].body,
    );
    expect(body).not.toHaveProperty("configSchema");
    expect(body).not.toHaveProperty("description");
  });

  it("throws when response is not ok", async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      text: () => Promise.resolve("Bad request"),
    });
    await expect(
      registerWithRegistry({
        registryUrl: "https://r.example.com",
        authApiUrl: "https://auth.example.com",
        schedulerApiKey: "k",
        agentId: "x",
        agentVersion: "1.0.0",
        agentUrl: "https://x.example.com",
        inputSchema: {},
        fetchFn,
      }),
    ).rejects.toThrow("Agent registry registration failed: 400 Bad request");
  });
});
