/** @vitest-environment node */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@workspace/agent-auth-client", () => ({
  verifyTokenViaAuthApi: vi.fn().mockResolvedValue(true),
}));

vi.mock("@mediapulse/env/agents-user-registration", () => ({
  env: {
    AGENT_DATA_API_URL: "http://data-api.example.com",
    AGENT_AUTH_API_URL: "http://auth.example.com",
    PORT: undefined,
    AGENT_REGISTRY_URL: undefined,
    AGENT_PUBLIC_URL: undefined,
    DOMAIN_INTEGRATION_API_KEY: undefined,
    DOMAIN_INTEGRATION_KEY: undefined,
  },
}));

vi.mock("@mediapulse/outlook-inbox", () => ({
  createOutlookInboxClient: vi.fn(() => ({
    listMessages: vi.fn().mockResolvedValue([]),
    archiveMessage: vi.fn().mockResolvedValue(undefined),
  })),
}));

vi.mock("@workspace/agent-data-api-client", () => ({
  createAgentDataApiClient: vi.fn(() => ({
    userRegistrationRegister: { create: vi.fn() },
    userRegistrationConfirm: { create: vi.fn() },
  })),
}));

vi.mock("resend", () => ({
  // Resend is instantiated with `new`, so the implementation must be a regular function.
  Resend: vi.fn().mockImplementation(function () {
    return { emails: { send: vi.fn() } };
  }),
}));

const AUTH_HEADERS = {
  Authorization: "Bearer test-token",
  "Content-Type": "application/json",
};

const VALID_CONFIG = {
  outlookClientId: "client-id",
  outlookClientSecret: "client-secret",
  outlookTenantId: "tenant-id",
  outlookUserId: "user-id",
  resendApiKey: "re_test_key",
  resendSender: "noreply@example.com",
};

describe("user-registration agent – watermark input validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each([
    ["non-date string", "not-a-date"],
    ["date-only string", "2024-01-01"],
    ["partial datetime", "2024-01-01T00:00"],
  ])("returns 400 when watermark is %s", async (_label, watermark) => {
    const { app } = await import("./index.js");
    const res = await app.request("http://localhost/", {
      method: "POST",
      headers: AUTH_HEADERS,
      body: JSON.stringify({ input: { watermark } }),
    });
    expect(res.status).toBe(400);
  });

  it("returns 200 when watermark is a valid ISO datetime string", async () => {
    const { app } = await import("./index.js");
    const res = await app.request("http://localhost/", {
      method: "POST",
      headers: AUTH_HEADERS,
      body: JSON.stringify({
        input: { watermark: "2024-01-01T00:00:00.000Z" },
        config: VALID_CONFIG,
      }),
    });
    expect(res.status).toBe(200);
  });

  it("returns 200 when watermark is absent", async () => {
    const { app } = await import("./index.js");
    const res = await app.request("http://localhost/", {
      method: "POST",
      headers: AUTH_HEADERS,
      body: JSON.stringify({ input: {}, config: VALID_CONFIG }),
    });
    expect(res.status).toBe(200);
  });
});
