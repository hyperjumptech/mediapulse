import { env } from "@workspace/env";
import { prisma } from "@workspace/database";
import type { Context } from "hono";
import { jwtVerify } from "jose";
import * as crypto from "crypto";

/** True if the string looks like a JWT (three base64url segments separated by dots). */
function looksLikeJwt(value: string): boolean {
  const parts = value.split(".");
  if (parts.length !== 3) return false;
  const base64url = /^[A-Za-z0-9_-]+$/;
  return parts.every((p) => p.length > 0 && base64url.test(p));
}

/**
 * Verifies an API key or short-lived JWT via Bearer token.
 * Accepts POST with Authorization: Bearer <token>.
 * If token looks like a JWT, verifies signature and expiry; otherwise looks up raw API key by hash.
 * Returns 200 with { valid: true } if valid, 401 otherwise.
 */
export async function verifyApiKey(context: Context) {
  const logger = context.get("logger");
  const authHeader = context.req.header("Authorization");
  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : "";

  if (!token) {
    return context.json({ valid: false }, 401);
  }

  try {
    if (looksLikeJwt(token)) {
      const secret = env.AGENT_AUTH_JWT_SECRET;
      if (!secret) {
        return context.json({ valid: false }, 401);
      }
      await jwtVerify(token, new TextEncoder().encode(secret), {
        issuer: "agent-auth-api",
        audience: "agent-invocation",
      });
      return context.json({ valid: true }, 200);
    }

    const hash = crypto.createHash("sha256").update(token).digest("hex");
    const apiKey = await prisma.aPIKey.findUnique({
      where: { key: hash, isActive: true },
      select: { userId: true },
    });

    if (apiKey?.userId) {
      return context.json({ valid: true }, 200);
    }
    return context.json({ valid: false }, 401);
  } catch (err) {
    logger.error({ err }, "Verify API key error");
    return context.json({ valid: false }, 401);
  }
}
