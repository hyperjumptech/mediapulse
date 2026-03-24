/** @vitest-environment node */
import { describe, expect, it } from "vitest";

import {
  decryptDomainIntegrationApiKey,
  decryptDomainIntegrationApiKeyWithFallback,
  deriveDomainIntegrationEncryptionKey,
  encryptDomainIntegrationApiKey,
} from "./encrypt-domain-integration-api-key";

describe("deriveDomainIntegrationEncryptionKey", () => {
  it("returns 32 bytes for a non-empty master key", () => {
    const key = deriveDomainIntegrationEncryptionKey(
      "test-master-key-32chars-min",
    );
    expect(key.length).toBe(32);
  });

  it("is deterministic for the same master key", () => {
    const a = deriveDomainIntegrationEncryptionKey("same-key");
    const b = deriveDomainIntegrationEncryptionKey("same-key");
    expect(Buffer.compare(a, b)).toBe(0);
  });
});

describe("encryptDomainIntegrationApiKey / decryptDomainIntegrationApiKey", () => {
  it("round-trips plaintext", () => {
    const master = "x".repeat(32);
    const secret = "dk_live_abc123";
    const enc = encryptDomainIntegrationApiKey(secret, master);
    expect(enc).not.toContain(secret);
    expect(decryptDomainIntegrationApiKey(enc, master)).toBe(secret);
  });

  it("uses different ciphertext for the same plaintext (random IV)", () => {
    const master = "y".repeat(32);
    const secret = "same";
    const a = encryptDomainIntegrationApiKey(secret, master);
    const b = encryptDomainIntegrationApiKey(secret, master);
    expect(a).not.toBe(b);
    expect(decryptDomainIntegrationApiKey(a, master)).toBe(secret);
    expect(decryptDomainIntegrationApiKey(b, master)).toBe(secret);
  });

  it("throws when decrypting with wrong master key", () => {
    const enc = encryptDomainIntegrationApiKey("s", "a".repeat(32));
    expect(() => decryptDomainIntegrationApiKey(enc, "b".repeat(32))).toThrow();
  });

  it("decrypts using fallback master key during rotation", () => {
    // Setup
    const oldMaster = "a".repeat(32);
    const newMaster = "b".repeat(32);
    const enc = encryptDomainIntegrationApiKey("rotating-secret", oldMaster);

    // Act
    const decrypted = decryptDomainIntegrationApiKeyWithFallback(
      enc,
      newMaster,
      oldMaster,
    );

    // Assert
    expect(decrypted).toBe("rotating-secret");
  });
});
