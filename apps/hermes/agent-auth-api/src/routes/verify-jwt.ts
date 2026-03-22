import { env } from "@hermes/env";
import type { Context } from "hono";
import { jwtVerify } from "jose";

/** True if the string looks like a JWT (three base64url segments separated by dots). */
function looksLikeJwt(value: string): boolean {
  const parts = value.split(".");
  if (parts.length !== 3) return false;
  const base64url = /^[A-Za-z0-9_-]+$/;
  return parts.every((p) => p.length > 0 && base64url.test(p));
}

/**
 * POST /api/verify — JWT-only invocation verification.
 * Accepts Authorization: Bearer &lt;JWT&gt;. Verifies signature and expiry with AGENT_AUTH_JWT_SECRET.
 * Returns 200 with { valid: true } if valid, 401 if invalid or not a JWT, 503 if JWT secret not configured.
 */
export async function verifyJwt(context: Context) {
  const logger = context.get("logger");
  const authHeader = context.req.header("Authorization");
  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : "";

  if (!token) {
    return context.json({ valid: false }, 401);
  }

  if (!looksLikeJwt(token)) {
    return context.json({ valid: false }, 401);
  }

  const secret = env.AGENT_AUTH_JWT_SECRET;
  if (!secret || secret.length < 16) {
    logger.warn(
      "AGENT_AUTH_JWT_SECRET not set or too short; JWT verification unavailable",
    );
    return context.json(
      {
        error: "JWT verification not configured",
        hint: "Set AGENT_AUTH_JWT_SECRET (32+ chars) and restart agent-auth-api.",
      },
      503,
    );
  }

  try {
    await jwtVerify(token, new TextEncoder().encode(secret), {
      issuer: "agent-auth-api",
      audience: "agent-invocation",
    });
    return context.json({ valid: true }, 200);
  } catch (err) {
    logger.error({ err }, "JWT verification failed");
    return context.json({ valid: false }, 401);
  }
}
