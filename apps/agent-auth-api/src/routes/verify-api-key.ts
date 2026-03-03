import { prisma } from "@workspace/database";
import type { Context } from "hono";
import * as crypto from "crypto";

/**
 * Verifies an API key via Bearer token. Accepts POST with Authorization: Bearer <token>.
 * Returns 200 with { valid: true } if the key exists and is active, 401 otherwise.
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
