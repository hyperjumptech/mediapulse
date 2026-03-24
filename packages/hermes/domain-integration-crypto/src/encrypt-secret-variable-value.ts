import {
  createCipheriv,
  createDecipheriv,
  hkdfSync,
  randomBytes,
} from "node:crypto";

const HKDF_INFO = Buffer.from("hermes-secret-variable-value-v1", "utf8");
const AES_KEY_LEN = 32;
const GCM_IV_LENGTH = 12;
const PAYLOAD_VERSION = 1;

export type EncryptedSecretVariablePayload = {
  v: typeof PAYLOAD_VERSION;
  iv: string;
  ciphertext: string;
  tag: string;
};

/**
 * Returns true when a string looks like an encrypted secret-variable payload.
 *
 * @param value - Raw database value from `variable.value`.
 * @returns Whether the value is a supported encrypted payload JSON string.
 */
export function isEncryptedSecretVariablePayload(value: string): boolean {
  try {
    const parsed = JSON.parse(value) as Partial<EncryptedSecretVariablePayload>;
    return (
      parsed.v === PAYLOAD_VERSION &&
      typeof parsed.iv === "string" &&
      typeof parsed.ciphertext === "string" &&
      typeof parsed.tag === "string"
    );
  } catch {
    return false;
  }
}

/**
 * Derives a 32-byte AES key for secret-variable encryption from Hermes master key.
 *
 * @param masterKey - `HERMES_INTERNAL_API_KEY` as UTF-8.
 * @returns AES-256 key material.
 */
export function deriveSecretVariableEncryptionKey(masterKey: string): Buffer {
  const raw = hkdfSync(
    "sha256",
    Buffer.from(masterKey, "utf8"),
    Buffer.alloc(0),
    HKDF_INFO,
    AES_KEY_LEN,
  );
  return Buffer.from(raw);
}

/**
 * Encrypts a secret variable value for storage in `variable.value`.
 *
 * @param plaintext - Raw secret variable value.
 * @param masterKey - `HERMES_INTERNAL_API_KEY` used to derive the wrapping key.
 * @returns JSON string safe to persist in Postgres `TEXT`.
 */
export function encryptSecretVariableValue(
  plaintext: string,
  masterKey: string,
): string {
  const key = deriveSecretVariableEncryptionKey(masterKey);
  const iv = randomBytes(GCM_IV_LENGTH);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(Buffer.from(plaintext, "utf8")),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  const payload: EncryptedSecretVariablePayload = {
    v: PAYLOAD_VERSION,
    iv: iv.toString("base64url"),
    ciphertext: ciphertext.toString("base64url"),
    tag: tag.toString("base64url"),
  };
  return JSON.stringify(payload);
}

/**
 * Decrypts a value produced by {@link encryptSecretVariableValue}.
 *
 * @param encryptedJson - Stored JSON from `variable.value`.
 * @param masterKey - Same master key used for encryption.
 * @returns Original variable plaintext.
 */
export function decryptSecretVariableValue(
  encryptedJson: string,
  masterKey: string,
): string {
  const parsed = JSON.parse(encryptedJson) as EncryptedSecretVariablePayload;
  if (parsed.v !== PAYLOAD_VERSION) {
    throw new Error("Unsupported encrypted secret variable payload version");
  }
  const key = deriveSecretVariableEncryptionKey(masterKey);
  const iv = Buffer.from(parsed.iv, "base64url");
  const ciphertext = Buffer.from(parsed.ciphertext, "base64url");
  const tag = Buffer.from(parsed.tag, "base64url");
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const plain = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plain.toString("utf8");
}

/**
 * Decrypts a secret variable value using primary key first, then optional fallback key.
 *
 * @param encryptedJson - Stored JSON from `variable.value`.
 * @param primaryMasterKey - Current canonical `HERMES_INTERNAL_API_KEY`.
 * @param fallbackMasterKey - Optional previous key used only during rotation.
 * @returns Original variable plaintext.
 */
export function decryptSecretVariableValueWithFallback(
  encryptedJson: string,
  primaryMasterKey: string,
  fallbackMasterKey?: string,
): string {
  try {
    return decryptSecretVariableValue(encryptedJson, primaryMasterKey);
  } catch (error) {
    const fallback = fallbackMasterKey?.trim();
    if (!fallback || fallback === primaryMasterKey) {
      throw error;
    }
    return decryptSecretVariableValue(encryptedJson, fallback);
  }
}
