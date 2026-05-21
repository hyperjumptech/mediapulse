/** @vitest-environment node */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { decodeJwt } from "jose";
import { Hono } from "hono";
import { logger, slimPinoLogger } from "@workspace/logger";
import { HERMES_INTERNAL_TOKEN_SUBJECT, issueToken } from "./issue-token";

const mockFindFirst = vi.fn();

const { issueTokenTestEnv } = vi.hoisted(() => ({
  issueTokenTestEnv: {
    AGENT_AUTH_JWT_SECRET: "test-secret-at-least-16-chars",
    HERMES_INTERNAL_API_KEY: "internal-preset-key-for-tests",
    HERMES_INTERNAL_API_KEY_PREVIOUS: "",
  },
}));

vi.mock("@hermes/orchestration-database", () => ({
  prisma: {
    encryptedPayload: {
      findFirst: (...args: unknown[]) => mockFindFirst(...args),
    },
  },
}));

vi.mock("@hermes/env", () => ({
  env: {
    get AGENT_AUTH_JWT_SECRET() {
      return issueTokenTestEnv.AGENT_AUTH_JWT_SECRET;
    },
    get HERMES_INTERNAL_API_KEY() {
      return issueTokenTestEnv.HERMES_INTERNAL_API_KEY;
    },
    get HERMES_INTERNAL_API_KEY_PREVIOUS() {
      return issueTokenTestEnv.HERMES_INTERNAL_API_KEY_PREVIOUS;
    },
  },
}));

describe("issueToken route", () => {
  const app = new Hono();
  app.use(slimPinoLogger({ pino: logger }));
  app.post("/api/token", issueToken);

  beforeEach(() => {
    vi.clearAllMocks();
    issueTokenTestEnv.AGENT_AUTH_JWT_SECRET = "test-secret-at-least-16-chars";
    issueTokenTestEnv.HERMES_INTERNAL_API_KEY = "internal-preset-key-for-tests";
    issueTokenTestEnv.HERMES_INTERNAL_API_KEY_PREVIOUS = "";
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 401 when Authorization header is missing", async () => {
    const res = await app.request("http://localhost/api/token", {
      method: "POST",
    });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toEqual({ error: "Missing Authorization: Bearer <api_key>" });
    expect(mockFindFirst).not.toHaveBeenCalled();
  });

  it("returns 503 when AGENT_AUTH_JWT_SECRET is not set", async () => {
    issueTokenTestEnv.AGENT_AUTH_JWT_SECRET = "";
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
    expect(mockFindFirst).not.toHaveBeenCalled();
    const body = await res.json();
    expect(body).toHaveProperty("token");
    expect(typeof body.token).toBe("string");
    expect(body.token.split(".")).toHaveLength(3);
    expect(body).toEqual(expect.objectContaining({ expiresIn: 7200 }));
    const claims = decodeJwt(body.token as string);
    expect(claims.sub).toBe(HERMES_INTERNAL_TOKEN_SUBJECT);
  });

  it("returns 200 with JWT when Bearer matches HERMES_INTERNAL_API_KEY_PREVIOUS", async () => {
    issueTokenTestEnv.HERMES_INTERNAL_API_KEY_PREVIOUS =
      "previous-internal-key";

    const res = await app.request("http://localhost/api/token", {
      method: "POST",
      headers: {
        Authorization: "Bearer previous-internal-key",
      },
    });

    expect(res.status).toBe(200);
    expect(mockFindFirst).not.toHaveBeenCalled();
    const body = await res.json();
    const claims = decodeJwt(body.token as string);
    expect(claims.sub).toBe(HERMES_INTERNAL_TOKEN_SUBJECT);
  });

  it("returns 401 when domain integration credential is not found", async () => {
    mockFindFirst.mockResolvedValue(null);
    const res = await app.request("http://localhost/api/token", {
      method: "POST",
      headers: { Authorization: "Bearer invalid-key" },
    });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toEqual({ error: "Invalid or inactive API key" });
  });

  it("returns 200 with JWT when Bearer matches encrypted_payload credential hash", async () => {
    mockFindFirst.mockResolvedValue({
      domainIntegration: { id: "di-uuid-1" },
    });
    const res = await app.request("http://localhost/api/token", {
      method: "POST",
      headers: { Authorization: "Bearer domain-key" },
    });
    expect(res.status).toBe(200);
    expect(mockFindFirst).toHaveBeenCalledOnce();
    const body = await res.json();
    const claims = decodeJwt(body.token as string);
    expect(claims.sub).toBe("di-uuid-1");
  });
});
