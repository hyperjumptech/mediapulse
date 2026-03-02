import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const USER_ID = "11111111-1111-4111-a111-111111111111";
const API_KEY_ID = "22222222-2222-4222-a222-222222222222";
const AUTH_HEADERS = {
  Authorization: `Basic ${Buffer.from("admin:password").toString("base64")}`,
};

vi.mock("@workspace/database", () => ({
  prisma: {
    aPIKey: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

vi.mock("@workspace/env", () => ({
  env: {
    TEMP_ADMIN_USERNAME: "admin",
    TEMP_ADMIN_PASSWORD: "password",
  },
}));

const getPrisma = async () => (await import("@workspace/database")).prisma;

describe("agent-auth-api", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("POST /api/api-keys", () => {
    it("returns 401 without Basic Auth", async () => {
      const { default: app } = await import("./index.js");
      const res = await app.fetch(
        new Request("http://localhost/api/api-keys", {
          method: "POST",
        }),
      );
      expect(res.status).toBe(401);
    });

    it("returns 201 and creates API key with valid body", async () => {
      const prisma = await getPrisma();
      (prisma.aPIKey.create as any).mockResolvedValue({
        id: API_KEY_ID,
        name: "Test Key",
        userId: USER_ID,
      });

      const { default: app } = await import("./index.js");
      const res = await app.fetch(
        new Request("http://localhost/api/api-keys", {
          method: "POST",
          headers: { ...AUTH_HEADERS, "Content-Type": "application/json" },
          body: JSON.stringify({
            name: "Test Key",
            userId: USER_ID,
          }),
        }),
      );

      const body = await res.json();
      expect(res.status).toBe(201);
      expect(body.message).toBe("API key created successfully");
      expect(body.data).toHaveProperty("key");
      expect(prisma.aPIKey.create).toHaveBeenCalled();
    });
  });

  describe("GET /api/api-keys", () => {
    it("returns 200 and list of API keys", async () => {
      const prisma = await getPrisma();
      (prisma.aPIKey.findMany as any).mockResolvedValue([
        { id: API_KEY_ID, name: "Test Key", userId: USER_ID },
      ]);

      const { default: app } = await import("./index.js");
      const res = await app.fetch(
        new Request("http://localhost/api/api-keys", {
          headers: AUTH_HEADERS,
        }),
      );

      const body = await res.json();
      expect(res.status).toBe(200);
      expect(body.data).toBeInstanceOf(Array);
      expect(body.data[0].name).toBe("Test Key");
    });
  });

  describe("GET /api/api-keys/:id", () => {
    it("returns 200 and API key details", async () => {
      const prisma = await getPrisma();
      (prisma.aPIKey.findUnique as any).mockResolvedValue({
        id: API_KEY_ID,
        name: "Test Key",
        userId: USER_ID,
      });

      const { default: app } = await import("./index.js");
      const res = await app.fetch(
        new Request(`http://localhost/api/api-keys/${API_KEY_ID}`, {
          headers: AUTH_HEADERS,
        }),
      );

      const body = await res.json();
      expect(res.status).toBe(200);
      expect(body.data.name).toBe("Test Key");
    });

    it("returns 404 if API key not found", async () => {
      const prisma = await getPrisma();
      (prisma.aPIKey.findUnique as any).mockResolvedValue(null);

      const { default: app } = await import("./index.js");
      const res = await app.fetch(
        new Request(`http://localhost/api/api-keys/${API_KEY_ID}`, {
          headers: AUTH_HEADERS,
        }),
      );

      expect(res.status).toBe(404);
    });
  });

  describe("DELETE /api/api-keys/:id", () => {
    it("returns 200 on successful deletion", async () => {
      const prisma = await getPrisma();
      (prisma.aPIKey.delete as any).mockResolvedValue({ id: API_KEY_ID });

      const { default: app } = await import("./index.js");
      const res = await app.fetch(
        new Request(`http://localhost/api/api-keys/${API_KEY_ID}`, {
          method: "DELETE",
          headers: AUTH_HEADERS,
        }),
      );

      const body = await res.json();
      expect(res.status).toBe(200);
      expect(body.message).toBe("API key deleted successfully");
    });
  });
});
