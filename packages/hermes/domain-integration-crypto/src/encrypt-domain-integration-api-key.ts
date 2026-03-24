import {
  createCipheriv,
  createDecipheriv,
  hkdfSync,
  randomBytes,
} from "node:crypto";

const HKDF_INFO = Buffer.from("hermes-domain-integration-api-key-v1", "utf8");
const AES_KEY_LEN = 32;
const GCM_IV_LENGTH = 12;
const PAYLOAD_VERSION = 1;

export type EncryptedDomainIntegrationApiKeyPayload = {
  v: typeof PAYLOAD_VERSION;
  iv: string;
  ciphertext: string;
  tag: string;
};

/**
 * Derives a 32-byte AES key from the Hermes internal master string using HKDF-SHA256.
 *
 * @param masterKey - `HERMES_INTERNAL_API_KEY` (or equivalent) as UTF-8.
 * @returns AES-256 key material.
 */
export function deriveDomainIntegrationEncryptionKey(
  masterKey: string,
): Buffer {
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
 * Encrypts a domain integration API key plaintext for storage on `EncryptedPayload.ciphertext` (linked from `DomainIntegration`).
 *
 * @param plaintext - Raw API key string shown once to the operator.
 * @param masterKey - `HERMES_INTERNAL_API_KEY` used to derive the wrapping key.
 * @returns JSON string safe to persist in Postgres `TEXT`.
 */
export function encryptDomainIntegrationApiKey(
  plaintext: string,
  masterKey: string,
): string {
  const key = deriveDomainIntegrationEncryptionKey(masterKey);
  const iv = randomBytes(GCM_IV_LENGTH);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(Buffer.from(plaintext, "utf8")),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  const payload: EncryptedDomainIntegrationApiKeyPayload = {
    v: PAYLOAD_VERSION,
    iv: iv.toString("base64url"),
    ciphertext: ciphertext.toString("base64url"),
    tag: tag.toString("base64url"),
  };
  return JSON.stringify(payload);
}

/**
 * Decrypts a value produced by {@link encryptDomainIntegrationApiKey}.
 *
 * @param encryptedJson - Stored JSON from `EncryptedPayload.ciphertext` for a domain integration.
 * @param masterKey - Same master key used for encryption.
 * @returns Original API key plaintext.
 */
export function decryptDomainIntegrationApiKey(
  encryptedJson: string,
  masterKey: string,
): string {
  const parsed = JSON.parse(
    encryptedJson,
  ) as EncryptedDomainIntegrationApiKeyPayload;
  if (parsed.v !== PAYLOAD_VERSION) {
    throw new Error("Unsupported encrypted API key payload version");
  }
  const key = deriveDomainIntegrationEncryptionKey(masterKey);
  const iv = Buffer.from(parsed.iv, "base64url");
  const ciphertext = Buffer.from(parsed.ciphertext, "base64url");
  const tag = Buffer.from(parsed.tag, "base64url");
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const plain = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plain.toString("utf8");
}

/**
 * Decrypts a domain integration API key using primary key first, then optional fallback key.
 *
 * @param encryptedJson - Stored JSON from `EncryptedPayload.ciphertext` for a domain integration.
 * @param primaryMasterKey - Current canonical `HERMES_INTERNAL_API_KEY`.
 * @param fallbackMasterKey - Optional previous key used only during rotation.
 * @returns Original API key plaintext.
 */
export function decryptDomainIntegrationApiKeyWithFallback(
  encryptedJson: string,
  primaryMasterKey: string,
  fallbackMasterKey?: string,
): string {
  try {
    return decryptDomainIntegrationApiKey(encryptedJson, primaryMasterKey);
  } catch (error) {
    const fallback = fallbackMasterKey?.trim();
    if (!fallback || fallback === primaryMasterKey) {
      throw error;
    }
    return decryptDomainIntegrationApiKey(encryptedJson, fallback);
  }
}
