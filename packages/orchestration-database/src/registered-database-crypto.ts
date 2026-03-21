import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { env } from "@workspace/env";

const ALGORITHM = "aes-256-gcm";
const IV_BYTE_LENGTH = 12;

const decodeKey = (rawKey: string): Buffer => {
  if (!rawKey) {
    throw new Error("REGISTERED_DATABASE_ENCRYPTION_KEY is required");
  }

  const base64Attempt = Buffer.from(rawKey, "base64");
  if (base64Attempt.length === 32) return base64Attempt;

  const hexAttempt = Buffer.from(rawKey, "hex");
  if (hexAttempt.length === 32) return hexAttempt;

  const utf8Attempt = Buffer.from(rawKey, "utf-8");
  if (utf8Attempt.length === 32) return utf8Attempt;

  throw new Error(
    "REGISTERED_DATABASE_ENCRYPTION_KEY must decode to 32 bytes (base64, hex, or raw 32-char string)",
  );
};

const getEncryptionKey = (): Buffer => {
  return decodeKey(env.REGISTERED_DATABASE_ENCRYPTION_KEY ?? "");
};

/**
 * Encrypts a plaintext database URL for storage.
 *
 * @param plaintext - Plain connection string.
 * @returns Base64-encoded payload containing iv, auth tag, and ciphertext.
 */
export const encryptRegisteredDatabaseUrl = (plaintext: string): string => {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_BYTE_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf-8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return Buffer.concat([iv, authTag, encrypted]).toString("base64");
};

/**
 * Decrypts a stored encrypted database URL.
 *
 * @param encryptedValue - Base64 payload from storage.
 * @returns Decrypted plaintext connection string.
 */
export const decryptRegisteredDatabaseUrl = (
  encryptedValue: string,
): string => {
  const key = getEncryptionKey();
  const payload = Buffer.from(encryptedValue, "base64");
  const iv = payload.subarray(0, IV_BYTE_LENGTH);
  const authTag = payload.subarray(IV_BYTE_LENGTH, IV_BYTE_LENGTH + 16);
  const ciphertext = payload.subarray(IV_BYTE_LENGTH + 16);

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return decrypted.toString("utf-8");
};
