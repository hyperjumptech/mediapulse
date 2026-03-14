import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { pinoLogger } from "hono-pino";
import { logger } from "@workspace/logger";
import { SignJWT } from "jose";
import { verifyApiKey } from "./verify-api-key";

const mockFindUnique = vi.fn();

vi.mock("@workspace/database", () => ({
  prisma: {
    aPIKey: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
    },
  },
}));

const jwtSecret = "verify-test-secret-at-least-16-chars";
vi.mock("@workspace/env", () => ({
  env: {
    get AGENT_AUTH_JWT_SECRET() {
      return process.env.AGENT_AUTH_JWT_SECRET ?? "";
    },
  },
}));

describe("verifyApiKey route", () => {
  const app = new Hono();
  app.use(pinoLogger({ pino: logger }));
  app.post("/api/verify", verifyApiKey);

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.AGENT_AUTH_JWT_SECRET = jwtSecret;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 401 when Authorization header is missing", async () => {
    const res = await app.request("http://localhost/api/verify", {
      method: "POST",
    });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toEqual({ valid: false });
    expect(mockFindUnique).not.toHaveBeenCalled();
  });

  it("returns 401 when API key is not found or inactive", async () => {
    mockFindUnique.mockResolvedValue(null);
    const res = await app.request("http://localhost/api/verify", {
      method: "POST",
      headers: { Authorization: "Bearer any-token" },
    });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toEqual({ valid: false });
    expect(mockFindUnique).toHaveBeenCalledOnce();
  });

  it("returns 200 with valid true when API key exists and is active", async () => {
    mockFindUnique.mockResolvedValue({ userId: "user-123" });
    const res = await app.request("http://localhost/api/verify", {
      method: "POST",
      headers: { Authorization: "Bearer valid-token" },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ valid: true });
    expect(mockFindUnique).toHaveBeenCalledOnce();
  });

  it("returns 200 with valid true when Bearer token is a valid JWT", async () => {
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: "HS256" })
      .setIssuer("agent-auth-api")
      .setAudience("agent-invocation")
      .setSubject("user-1")
      .setIssuedAt(Math.floor(Date.now() / 1000))
      .setExpirationTime(Math.floor(Date.now() / 1000) + 900)
      .sign(new TextEncoder().encode(jwtSecret));

    const res = await app.request("http://localhost/api/verify", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ valid: true });
    expect(mockFindUnique).not.toHaveBeenCalled();
  });

  it("returns 401 when Bearer token looks like JWT but AGENT_AUTH_JWT_SECRET is unset", async () => {
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: "HS256" })
      .setIssuer("agent-auth-api")
      .setAudience("agent-invocation")
      .setSubject("user-1")
      .setIssuedAt(Math.floor(Date.now() / 1000))
      .setExpirationTime(Math.floor(Date.now() / 1000) + 900)
      .sign(new TextEncoder().encode(jwtSecret));

    delete process.env.AGENT_AUTH_JWT_SECRET;
    const res = await app.request("http://localhost/api/verify", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    process.env.AGENT_AUTH_JWT_SECRET = jwtSecret;
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toEqual({ valid: false });
  });
});
