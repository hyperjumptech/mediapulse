/** @vitest-environment node */
import { describe, expect, it } from "vitest";

import {
  decryptSecretVariableValue,
  decryptSecretVariableValueWithFallback,
  deriveSecretVariableEncryptionKey,
  encryptSecretVariableValue,
  isEncryptedSecretVariablePayload,
} from "./encrypt-secret-variable-value";

describe("deriveSecretVariableEncryptionKey", () => {
  it("returns 32 bytes for a non-empty master key", () => {
    // Act
    const key = deriveSecretVariableEncryptionKey(
      "test-master-key-32chars-min",
    );

    // Assert
    expect(key.length).toBe(32);
  });

  it("is deterministic for the same master key", () => {
    // Act
    const first = deriveSecretVariableEncryptionKey("same-key");
    const second = deriveSecretVariableEncryptionKey("same-key");

    // Assert
    expect(Buffer.compare(first, second)).toBe(0);
  });
});

describe("encryptSecretVariableValue / decryptSecretVariableValue", () => {
  it("round-trips plaintext", () => {
    // Setup
    const master = "x".repeat(32);
    const secret = "api-secret-value";

    // Act
    const encrypted = encryptSecretVariableValue(secret, master);
    const decrypted = decryptSecretVariableValue(encrypted, master);

    // Assert
    expect(encrypted).not.toContain(secret);
    expect(decrypted).toBe(secret);
  });

  it("uses different ciphertext for the same plaintext (random IV)", () => {
    // Setup
    const master = "y".repeat(32);
    const secret = "same-value";

    // Act
    const first = encryptSecretVariableValue(secret, master);
    const second = encryptSecretVariableValue(secret, master);

    // Assert
    expect(first).not.toBe(second);
    expect(decryptSecretVariableValue(first, master)).toBe(secret);
    expect(decryptSecretVariableValue(second, master)).toBe(secret);
  });

  it("throws when decrypting with wrong master key", () => {
    // Setup
    const encrypted = encryptSecretVariableValue("s", "a".repeat(32));

    // Act & Assert
    expect(() =>
      decryptSecretVariableValue(encrypted, "b".repeat(32)),
    ).toThrow();
  });

  it("throws for malformed payload", () => {
    // Act & Assert
    expect(() =>
      decryptSecretVariableValue('{"v":1,"iv":"x"}', "a".repeat(32)),
    ).toThrow();
  });

  it("decrypts using fallback master key during rotation", () => {
    // Setup
    const oldMaster = "a".repeat(32);
    const newMaster = "b".repeat(32);
    const encrypted = encryptSecretVariableValue("rotate-me", oldMaster);

    // Act
    const decrypted = decryptSecretVariableValueWithFallback(
      encrypted,
      newMaster,
      oldMaster,
    );

    // Assert
    expect(decrypted).toBe("rotate-me");
  });
});

describe("isEncryptedSecretVariablePayload", () => {
  it("returns true for encrypted payload format", () => {
    // Setup
    const encrypted = encryptSecretVariableValue("value", "m".repeat(32));

    // Act
    const result = isEncryptedSecretVariablePayload(encrypted);

    // Assert
    expect(result).toBe(true);
  });

  it("returns false for plaintext values", () => {
    // Act
    const result = isEncryptedSecretVariablePayload("plain-text");

    // Assert
    expect(result).toBe(false);
  });
});
