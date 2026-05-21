/** @vitest-environment node */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { logger, slimPinoLogger } from "@workspace/logger";
import { SignJWT } from "jose";
import { verifyJwt } from "./verify-jwt";

const { verifyJwtTestSecret, verifyJwtTestEnv } = vi.hoisted(() => {
  const secret = "verify-jwt-test-secret-at-least-16-chars";
  return {
    verifyJwtTestSecret: secret,
    verifyJwtTestEnv: {
      AGENT_AUTH_JWT_SECRET: secret,
    },
  };
});

vi.mock("@hermes/env", () => ({
  env: {
    get AGENT_AUTH_JWT_SECRET() {
      return verifyJwtTestEnv.AGENT_AUTH_JWT_SECRET;
    },
  },
}));

describe("verifyJwt route", () => {
  const app = new Hono();
  app.use(slimPinoLogger({ pino: logger }));
  app.post("/api/verify", verifyJwt);

  beforeEach(() => {
    verifyJwtTestEnv.AGENT_AUTH_JWT_SECRET = verifyJwtTestSecret;
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
  });

  it("returns 401 when Bearer token does not look like a JWT", async () => {
    const res = await app.request("http://localhost/api/verify", {
      method: "POST",
      headers: { Authorization: "Bearer raw-api-key-not-jwt" },
    });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toEqual({ valid: false });
  });

  it("returns 503 when token looks like JWT but AGENT_AUTH_JWT_SECRET is unset", async () => {
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: "HS256" })
      .setIssuer("agent-auth-api")
      .setAudience("agent-invocation")
      .setSubject("user-1")
      .setIssuedAt(Math.floor(Date.now() / 1000))
      .setExpirationTime(Math.floor(Date.now() / 1000) + 900)
      .sign(new TextEncoder().encode(verifyJwtTestSecret));

    verifyJwtTestEnv.AGENT_AUTH_JWT_SECRET = "";
    const res = await app.request("http://localhost/api/verify", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    verifyJwtTestEnv.AGENT_AUTH_JWT_SECRET = verifyJwtTestSecret;
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error).toBe("JWT verification not configured");
  });

  it("returns 200 with valid true when Bearer token is a valid JWT", async () => {
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: "HS256" })
      .setIssuer("agent-auth-api")
      .setAudience("agent-invocation")
      .setSubject("user-1")
      .setIssuedAt(Math.floor(Date.now() / 1000))
      .setExpirationTime(Math.floor(Date.now() / 1000) + 900)
      .sign(new TextEncoder().encode(verifyJwtTestSecret));

    const res = await app.request("http://localhost/api/verify", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ valid: true });
  });

  it("returns 401 when JWT is expired", async () => {
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: "HS256" })
      .setIssuer("agent-auth-api")
      .setAudience("agent-invocation")
      .setSubject("user-1")
      .setIssuedAt(Math.floor(Date.now() / 1000) - 3600)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 1800)
      .sign(new TextEncoder().encode(verifyJwtTestSecret));

    const res = await app.request("http://localhost/api/verify", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toEqual({ valid: false });
  });
});
