import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Returns a stable SHA-256 hex hash for an HTTP trigger bearer token.
 *
 * @param token - Raw token provided by an admin or caller.
 * @returns Hex-encoded SHA-256 digest.
 */
export const hashHttpTriggerToken = (token: string): string =>
  createHash("sha256").update(token).digest("hex");

/**
 * Builds a short non-sensitive hint for UI display (never the full token).
 *
 * @param token - Raw token.
 * @returns Last four characters prefixed with `...`, or null if too short.
 */
export const createTokenHint = (token: string): string | null => {
  const trimmed = token.trim();
  if (trimmed.length < 4) return null;
  return `...${trimmed.slice(-4)}`;
};

/**
 * Verifies a raw token against a stored SHA-256 hash in constant time.
 *
 * @param rawToken - Raw token from Authorization header.
 * @param expectedHashHex - Stored SHA-256 hash (hex).
 * @returns True when token hash matches expected hash.
 */
export const verifyHttpTriggerToken = (
  rawToken: string,
  expectedHashHex: string,
): boolean => {
  const provided = Buffer.from(hashHttpTriggerToken(rawToken), "hex");
  const expected = Buffer.from(expectedHashHex, "hex");
  if (provided.length !== expected.length) return false;
  return timingSafeEqual(provided, expected);
};
