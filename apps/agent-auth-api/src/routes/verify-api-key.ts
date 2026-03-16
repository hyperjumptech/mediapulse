import { prisma } from "@workspace/database";
import type { Context } from "hono";
import * as crypto from "crypto";

/**
 * POST /api/verify-api-key — API-key verification for service callers (agent-data-api, agent-registry-api).
 * Accepts Authorization: Bearer &lt;api_key&gt;. Looks up hashed key in DB; returns 200 with { valid: true } if active key exists, 401 otherwise.
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
