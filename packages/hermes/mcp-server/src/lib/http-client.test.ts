import { afterEach, describe, expect, it, vi } from "vitest";

import {
  buildHermesRequestUrl,
  createHermesHttpClient,
  parseHermesResponseBody,
  redactApiKeyFromMessage,
} from "./http-client.js";
import type { HermesMcpProfile } from "./profiles.js";

const testProfile: HermesMcpProfile = {
  name: "PROD",
  baseUrl: "https://hermes.example.com",
  apiKey: "test-api-key-secret",
};

describe("buildHermesRequestUrl", () => {
  it("joins base URL and path and strips trailing slash from base", () => {
    // Act
    const url = buildHermesRequestUrl(
      { ...testProfile, baseUrl: "https://hermes.example.com/" },
      "/api/mcp/whoami",
    );

    // Assert
    expect(url).toBe("https://hermes.example.com/api/mcp/whoami");
  });

  it("appends query parameters", () => {
    // Act
    const url = buildHermesRequestUrl(testProfile, "/api/schedules", {
      limit: 10,
      cursor: "abc",
    });

    // Assert
    expect(url).toBe(
      "https://hermes.example.com/api/schedules?limit=10&cursor=abc",
    );
  });
});

describe("parseHermesResponseBody", () => {
  it("parses JSON responses", async () => {
    // Setup
    const response = new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

    // Act
    const parsed = await parseHermesResponseBody(response);

    // Assert
    expect(parsed.body).toEqual({ ok: true });
    expect(parsed.text).toContain("ok");
  });

  it("returns plain text when body is not JSON", async () => {
    // Setup
    const response = new Response("not-json", { status: 500 });

    // Act
    const parsed = await parseHermesResponseBody(response);

    // Assert
    expect(parsed.body).toBe("not-json");
  });
});

describe("redactApiKeyFromMessage", () => {
  it("redacts the API key from messages", () => {
    expect(
      redactApiKeyFromMessage(
        "Failed with token test-api-key-secret in header",
        "test-api-key-secret",
      ),
    ).toBe("Failed with token [REDACTED] in header");
  });
});

describe("createHermesHttpClient", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sends Authorization Bearer and returns JSON body", async () => {
    // Setup
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ label: "ci" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const client = createHermesHttpClient({
      getProfile: () => ({ profile: testProfile }),
      fetchImpl,
    });

    // Act
    const result = await client.request({
      method: "GET",
      path: "/api/mcp/whoami",
    });

    // Assert
    expect(result.status).toBe(200);
    expect(result.body).toEqual({ label: "ci" });
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://hermes.example.com/api/mcp/whoami",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Authorization: "Bearer test-api-key-secret",
        }),
      }),
    );
    expect(JSON.stringify(fetchImpl.mock.calls)).not.toContain("console");
  });

  it("returns profile configuration error without calling fetch", async () => {
    // Setup
    const fetchImpl = vi.fn();
    const client = createHermesHttpClient({
      getProfile: () => ({ error: "No profile" }),
      fetchImpl,
    });

    // Act
    const result = await client.request({
      method: "GET",
      path: "/api/mcp/whoami",
    });

    // Assert
    expect(result.status).toBe(0);
    expect(result.body).toEqual({ error: "No profile" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("surfaces Hermes 401 error body", async () => {
    // Setup
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
      }),
    );
    const client = createHermesHttpClient({
      getProfile: () => ({ profile: testProfile }),
      fetchImpl,
    });

    // Act
    const result = await client.request({
      method: "GET",
      path: "/api/mcp/whoami",
    });

    // Assert
    expect(result.status).toBe(401);
    expect(result.body).toEqual({ error: "Unauthorized" });
  });

  it("POSTs JSON body for dashboard read actions", async () => {
    // Setup
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ success: true, data: { id: "x" } }), {
        status: 200,
      }),
    );
    const client = createHermesHttpClient({
      getProfile: () => ({ profile: testProfile }),
      fetchImpl,
    });

    // Act
    await client.request({
      method: "POST",
      path: "/dashboard/variables/actions/get",
      body: { id: "550e8400-e29b-41d4-a716-446655440000" },
    });

    // Assert
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://hermes.example.com/dashboard/variables/actions/get",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          id: "550e8400-e29b-41d4-a716-446655440000",
        }),
      }),
    );
  });

  it("redacts API key from network error messages", async () => {
    // Setup
    const fetchImpl = vi
      .fn()
      .mockRejectedValue(new Error("Bearer test-api-key-secret leaked"));
    const client = createHermesHttpClient({
      getProfile: () => ({ profile: testProfile }),
      fetchImpl,
    });

    // Act
    const result = await client.request({
      method: "GET",
      path: "/api/mcp/whoami",
    });

    // Assert
    expect(result.status).toBe(0);
    expect((result.body as { error: string }).error).not.toContain(
      "test-api-key-secret",
    );
    expect((result.body as { error: string }).error).toContain("[REDACTED]");
  });
});
