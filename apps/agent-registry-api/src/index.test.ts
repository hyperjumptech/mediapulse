import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const AUTH_HEADERS = { Authorization: "Bearer test-token" };

vi.mock("@workspace/database", () => ({
  prisma: {
    aPIKey: {
      findUnique: vi.fn(),
    },
    agentRegistry: {
      create: vi.fn(),
    },
  },
}));

vi.mock("@workspace/env", () => ({
  env: {
    DATABASE_URL: "postgresql://user:pass@localhost:5432/db",
    TEMP_ADMIN_USERNAME: "admin",
    TEMP_ADMIN_PASSWORD: "password",
  },
}));

const getPrisma = async () => (await import("@workspace/database")).prisma;

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
      (prisma.aPIKey.findUnique as any).mockResolvedValue({
        userId: "123",
        name: "test",
      });
      (prisma.agentRegistry.create as any).mockResolvedValue({
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
