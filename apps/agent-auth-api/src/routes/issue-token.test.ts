import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { pinoLogger } from "hono-pino";
import { logger } from "@workspace/logger";
import { issueToken } from "./issue-token";

const mockFindUnique = vi.fn();

vi.mock("@workspace/database", () => ({
  prisma: {
    aPIKey: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
    },
  },
}));

const originalEnv = process.env;
vi.mock("@workspace/env", () => ({
  env: {
    get AGENT_AUTH_JWT_SECRET() {
      return process.env.AGENT_AUTH_JWT_SECRET ?? "";
    },
  },
}));

describe("issueToken route", () => {
  const app = new Hono();
  app.use(pinoLogger({ pino: logger }));
  app.post("/api/token", issueToken);

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = {
      ...originalEnv,
      AGENT_AUTH_JWT_SECRET: "test-secret-at-least-16-chars",
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.env = originalEnv;
  });

  it("returns 401 when Authorization header is missing", async () => {
    const res = await app.request("http://localhost/api/token", {
      method: "POST",
    });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toEqual({ error: "Missing Authorization: Bearer <api_key>" });
    expect(mockFindUnique).not.toHaveBeenCalled();
  });

  it("returns 503 when AGENT_AUTH_JWT_SECRET is not set", async () => {
    delete process.env.AGENT_AUTH_JWT_SECRET;
    const res = await app.request("http://localhost/api/token", {
      method: "POST",
      headers: { Authorization: "Bearer some-key" },
    });
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body).toEqual({ error: "Token issuance not configured" });
  });

  it("returns 401 when API key is not found or inactive", async () => {
    mockFindUnique.mockResolvedValue(null);
    const res = await app.request("http://localhost/api/token", {
      method: "POST",
      headers: { Authorization: "Bearer invalid-key" },
    });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toEqual({ error: "Invalid or inactive API key" });
  });

  it("returns 403 when API key purpose is not scheduler", async () => {
    mockFindUnique.mockResolvedValue({
      id: "key-1",
      userId: "user-1",
      purpose: "general",
    });
    const res = await app.request("http://localhost/api/token", {
      method: "POST",
      headers: { Authorization: "Bearer general-key" },
    });
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body).toEqual({
      error: "API key must have purpose 'scheduler' to issue tokens",
    });
  });

  it("returns 200 with token and expiresIn when key has purpose scheduler", async () => {
    mockFindUnique.mockResolvedValue({
      id: "key-1",
      userId: "user-1",
      purpose: "scheduler",
    });
    const res = await app.request("http://localhost/api/token", {
      method: "POST",
      headers: { Authorization: "Bearer scheduler-key" },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("token");
    expect(typeof body.token).toBe("string");
    expect(body.token.split(".")).toHaveLength(3);
    expect(body).toEqual(expect.objectContaining({ expiresIn: 900 }));
    expect(mockFindUnique).toHaveBeenCalledOnce();
  });
});
