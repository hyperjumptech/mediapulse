import { createHash, randomBytes } from "node:crypto";

/** TTL for password-reset links (1 hour). */
export const HERMES_ADMIN_RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

/**
 * Returns a SHA-256 hex digest of the raw token for storage in the database.
 *
 * @param rawToken - Opaque secret from the reset URL (never store this verbatim).
 * @returns Lowercase hex digest.
 */
export const hashHermesAdminResetToken = (rawToken: string): string => {
  return createHash("sha256").update(rawToken, "utf8").digest("hex");
};

/**
 * Generates a new random raw token and its stored hash for a reset row.
 *
 * @param randomBytesFn - Injectable RNG (default: 32 bytes from `crypto.randomBytes`).
 * @returns Raw token for the email link and hash to persist.
 */
export const generateHermesAdminResetToken = (
  randomBytesFn: (size: number) => Buffer = randomBytes,
): { rawToken: string; tokenHash: string } => {
  const rawToken = randomBytesFn(32).toString("base64url");
  return { rawToken, tokenHash: hashHermesAdminResetToken(rawToken) };
};
