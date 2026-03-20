import { env } from "@workspace/env";
import { prisma } from "@workspace/database";
import * as crypto from "crypto";
import { SignJWT } from "jose";
import type { Context } from "hono";

const SCHEDULER_PURPOSE = "scheduler";
const TOKEN_EXPIRY_SECONDS = 900; // 15 minutes
const JWT_ISSUER = "agent-auth-api";
const JWT_AUDIENCE = "agent-invocation";

/**
 * POST /api/token — issue a short-lived JWT for agent invocation.
 * Caller sends Authorization: Bearer <api_key>. The API key must exist, be active, and have purpose "scheduler".
 * Returns { token, expiresIn } or 401/503.
 */
export async function issueToken(context: Context) {
  const logger = context.get("logger");
  const authHeader = context.req.header("Authorization");
  const rawKey = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : "";

  if (!rawKey) {
    return context.json(
      { error: "Missing Authorization: Bearer <api_key>" },
      401,
    );
  }

  const jwtSecret = env.AGENT_AUTH_JWT_SECRET;
  if (!jwtSecret || jwtSecret.length < 16) {
    logger.warn(
      "AGENT_AUTH_JWT_SECRET not set or too short (< 16 chars); token issuance disabled",
    );
    return context.json(
      {
        error: "Token issuance not configured",
        hint: "Set AGENT_AUTH_JWT_SECRET in packages/env/.env (32+ chars), then restart agent-auth-api. See dev-docs/docs/getting-started.mdx.",
      },
      503,
    );
  }

  try {
    const hash = crypto.createHash("sha256").update(rawKey).digest("hex");
    const apiKey = await prisma.aPIKey.findUnique({
      where: { key: hash, isActive: true },
      select: { id: true, userId: true, purpose: true },
    });

    if (!apiKey) {
      return context.json({ error: "Invalid or inactive API key" }, 401);
    }

    const purpose = apiKey.purpose ?? "general";
    if (purpose !== SCHEDULER_PURPOSE) {
      return context.json(
        { error: "API key must have purpose 'scheduler' to issue tokens" },
        403,
      );
    }

    const now = Math.floor(Date.now() / 1000);
    const exp = now + TOKEN_EXPIRY_SECONDS;
    const secret = new TextEncoder().encode(jwtSecret);
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: "HS256" })
      .setIssuer(JWT_ISSUER)
      .setAudience(JWT_AUDIENCE)
      .setSubject(apiKey.userId)
      .setIssuedAt(now)
      .setExpirationTime(exp)
      .sign(secret);

    return context.json({ token, expiresIn: TOKEN_EXPIRY_SECONDS }, 200);
  } catch (err) {
    logger.error({ err }, "Issue token error");
    return context.json({ error: "Internal server error" }, 500);
  }
}
