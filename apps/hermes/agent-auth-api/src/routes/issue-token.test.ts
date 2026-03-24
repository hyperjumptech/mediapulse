/** @vitest-environment node */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { decodeJwt } from "jose";
import { Hono } from "hono";
import { pinoLogger } from "hono-pino";
import { logger } from "@workspace/logger";
import { HERMES_INTERNAL_TOKEN_SUBJECT, issueToken } from "./issue-token";

const mockFindUnique = vi.fn();

vi.mock("@hermes/orchestration-database", () => ({
  prisma: {
    aPIKey: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
    },
  },
}));

const originalEnv = process.env;
vi.mock("@hermes/env", () => ({
  env: {
    get AGENT_AUTH_JWT_SECRET() {
      return process.env.AGENT_AUTH_JWT_SECRET ?? "";
    },
    get HERMES_INTERNAL_API_KEY() {
      return process.env.HERMES_INTERNAL_API_KEY ?? "";
    },
    get HERMES_INTERNAL_API_KEY_PREVIOUS() {
      return process.env.HERMES_INTERNAL_API_KEY_PREVIOUS ?? "";
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
      HERMES_INTERNAL_API_KEY: "internal-preset-key-for-tests",
      HERMES_INTERNAL_API_KEY_PREVIOUS: "",
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
    expect(body.error).toBe("Token issuance not configured");
    expect(body).toHaveProperty("hint");
  });

  it("returns 200 with JWT when Bearer matches HERMES_INTERNAL_API_KEY without DB lookup", async () => {
    const res = await app.request("http://localhost/api/token", {
      method: "POST",
      headers: {
        Authorization: "Bearer internal-preset-key-for-tests",
      },
    });
    expect(res.status).toBe(200);
    expect(mockFindUnique).not.toHaveBeenCalled();
    const body = await res.json();
    expect(body).toHaveProperty("token");
    expect(typeof body.token).toBe("string");
    expect(body.token.split(".")).toHaveLength(3);
    expect(body).toEqual(expect.objectContaining({ expiresIn: 900 }));
    const claims = decodeJwt(body.token as string);
    expect(claims.sub).toBe(HERMES_INTERNAL_TOKEN_SUBJECT);
  });

  it("returns 200 with JWT when Bearer matches HERMES_INTERNAL_API_KEY_PREVIOUS", async () => {
    // Setup
    process.env.HERMES_INTERNAL_API_KEY_PREVIOUS = "previous-internal-key";

    // Act
    const res = await app.request("http://localhost/api/token", {
      method: "POST",
      headers: {
        Authorization: "Bearer previous-internal-key",
      },
    });

    // Assert
    expect(res.status).toBe(200);
    expect(mockFindUnique).not.toHaveBeenCalled();
    const body = await res.json();
    const claims = decodeJwt(body.token as string);
    expect(claims.sub).toBe(HERMES_INTERNAL_TOKEN_SUBJECT);
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

  it("returns 403 when API key purpose is not domain_integration or scheduler", async () => {
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
      error:
        "API key must have purpose 'domain_integration' or 'scheduler' to issue tokens",
    });
  });

  it("returns 200 when key has purpose domain_integration", async () => {
    mockFindUnique.mockResolvedValue({
      id: "key-1",
      userId: "user-domain",
      purpose: "domain_integration",
    });
    const res = await app.request("http://localhost/api/token", {
      method: "POST",
      headers: { Authorization: "Bearer domain-key" },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    const claims = decodeJwt(body.token as string);
    expect(claims.sub).toBe("key-1");
  });

  it("returns 200 with token when key has purpose scheduler", async () => {
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
    const claims = decodeJwt(body.token as string);
    expect(claims.sub).toBe("key-1");
  });
});
