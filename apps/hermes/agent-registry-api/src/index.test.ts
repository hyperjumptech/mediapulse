import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const AUTH_HEADERS = { Authorization: "Bearer test-token" };

vi.mock("@workspace/agent-auth-client", () => ({
  verifyApiKeyViaAuthApi: vi.fn().mockResolvedValue(true),
}));

vi.mock("@hermes/orchestration-database", () => ({
  prisma: {
    agentRegistry: {
      upsert: vi.fn(),
    },
  },
}));

vi.mock("@hermes/env", () => ({
  env: {
    AGENT_AUTH_API_URL: "https://auth.example.com",
    ORCHESTRATION_DATABASE_URL:
      "postgresql://user:pass@localhost:5432/db?schema=orchestration",
    MEDIAPULSE_DATABASE_URL:
      "postgresql://user:pass@localhost:5432/db?schema=mediapulse",
    TEMP_ADMIN_USERNAME: "admin",
    TEMP_ADMIN_PASSWORD: "password",
  },
}));

const getPrisma = async () =>
  (await import("@hermes/orchestration-database")).prisma;

describe("agent-registry-api", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("POST /api/agents/register", () => {
    it("returns 401 without Authorization header", async () => {
      const { default: app } = await import("./index.js");
      const res = await app.fetch(
        new Request("http://localhost/api/agents/register", {
          method: "POST",
        }),
      );
      expect(res.status).toBe(401);
    });

    it("returns 200 and registers agent with valid body and token", async () => {
      const prisma = await getPrisma();
      (prisma.agentRegistry.upsert as any).mockResolvedValue({
        id: "1",
        agentId: "test-agent",
        agentVersion: "1.0.0",
        endpoint: { url: "http://example.com", method: "POST" },
      });

      const { default: app } = await import("./index.js");
      const res = await app.fetch(
        new Request("http://localhost/api/agents/register", {
          method: "POST",
          headers: { ...AUTH_HEADERS, "Content-Type": "application/json" },
          body: JSON.stringify({
            agentId: "test-agent",
            agentVersion: "1.0.0",
            endpoint: {
              url: "http://example.com",
              method: "POST",
            },
            inputSchema: { type: "object", properties: {} },
          }),
        }),
      );

      const body = await res.json();
      expect(res.status).toBe(200);
      expect(body.message).toBe("Agent registered successfully");
      expect(body.data.agentId).toBe("test-agent");
    });
  });
});
