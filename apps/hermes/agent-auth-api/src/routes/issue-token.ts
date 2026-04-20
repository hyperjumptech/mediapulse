import { env } from "@hermes/env";
import { prisma } from "@hermes/orchestration-database";
import * as crypto from "crypto";
import { SignJWT } from "jose";
import type { Context } from "hono";

const TOKEN_EXPIRY_SECONDS = 7200; // 2 hours
const JWT_ISSUER = "agent-auth-api";
const JWT_AUDIENCE = "agent-invocation";

/**
 * JWT `sub` for tokens minted with `HERMES_INTERNAL_API_KEY`. Not stored in the orchestration DB;
 * verify-jwt only checks signature, iss, aud, and expiry.
 */
export const HERMES_INTERNAL_TOKEN_SUBJECT =
  "00000000-0000-4000-8000-000000000001";

/**
 * Returns true if two UTF-8 strings are equal in constant time (same length only).
 *
 * @param a - First secret string.
 * @param b - Second secret string.
 * @returns Whether the strings are identical.
 */
function timingSafeStringEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) {
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Signs a short-lived agent-invocation JWT.
 *
 * @param subject - JWT subject (`sub` claim).
 * @param jwtSecret - HS256 secret.
 * @returns Token string and expiry seconds.
 */
async function signInvocationJwt(
  subject: string,
  jwtSecret: string,
): Promise<{ token: string; expiresIn: number }> {
  const now = Math.floor(Date.now() / 1000);
  const exp = now + TOKEN_EXPIRY_SECONDS;
  const secret = new TextEncoder().encode(jwtSecret);
  const token = await new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(JWT_ISSUER)
    .setAudience(JWT_AUDIENCE)
    .setSubject(subject)
    .setIssuedAt(now)
    .setExpirationTime(exp)
    .sign(secret);
  return { token, expiresIn: TOKEN_EXPIRY_SECONDS };
}

/**
 * POST /api/token — issue a short-lived JWT for agent invocation.
 * Accepts either:
 * - `Authorization: Bearer <HERMES_INTERNAL_API_KEY>` (Hermes worker/dashboard; `sub` is {@link HERMES_INTERNAL_TOKEN_SUBJECT}), or
 * - `Authorization: Bearer <domain_integration_api_key>` where the SHA-256 hex is stored on `encrypted_payload.credential_sha256_hex` (`sub` is `domain_integration.id`).
 * Returns { token, expiresIn } or 401/403/503.
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
        hint: "Set AGENT_AUTH_JWT_SECRET in packages/hermes/env/.env (32+ chars), then restart agent-auth-api. See dev-docs/docs/getting-started.mdx.",
      },
      503,
    );
  }

  try {
    const internalKey = env.HERMES_INTERNAL_API_KEY?.trim() ?? "";
    const previousInternalKey =
      env.HERMES_INTERNAL_API_KEY_PREVIOUS?.trim() ?? "";
    const matchesInternalKey =
      internalKey.length > 0 && timingSafeStringEqual(rawKey, internalKey);
    const matchesPreviousInternalKey =
      previousInternalKey.length > 0 &&
      previousInternalKey !== internalKey &&
      timingSafeStringEqual(rawKey, previousInternalKey);
    if (matchesInternalKey || matchesPreviousInternalKey) {
      const { token, expiresIn } = await signInvocationJwt(
        HERMES_INTERNAL_TOKEN_SUBJECT,
        jwtSecret,
      );
      return context.json({ token, expiresIn }, 200);
    }

    const hash = crypto.createHash("sha256").update(rawKey).digest("hex");
    const payloadRow = await prisma.encryptedPayload.findFirst({
      where: {
        credentialSha256Hex: hash,
        domainIntegrationId: { not: null },
      },
      include: { domainIntegration: true },
    });

    if (!payloadRow?.domainIntegration) {
      return context.json({ error: "Invalid or inactive API key" }, 401);
    }

    const { token, expiresIn } = await signInvocationJwt(
      payloadRow.domainIntegration.id,
      jwtSecret,
    );
    return context.json({ token, expiresIn }, 200);
  } catch (err) {
    logger.error({ err }, "Issue token error");
    return context.json({ error: "Internal server error" }, 500);
  }
}
