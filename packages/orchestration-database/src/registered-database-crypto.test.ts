/** @vitest-environment node */
import { describe, expect, it } from "vitest";

import {
  decryptRegisteredDatabaseUrl,
  encryptRegisteredDatabaseUrl,
} from "./registered-database-crypto";

describe("registered-database-crypto", () => {
  it("round-trips a connection string", () => {
    const plaintext =
      "postgresql://user:pass@localhost:5432/db?schema=mediapulse";
    const encrypted = encryptRegisteredDatabaseUrl(plaintext);
    expect(encrypted).not.toContain(plaintext);
    expect(decryptRegisteredDatabaseUrl(encrypted)).toBe(plaintext);
  });

  it("throws when decrypting corrupted ciphertext", () => {
    const encrypted = encryptRegisteredDatabaseUrl("postgresql://x");
    const tampered = Buffer.from(encrypted, "base64");
    const last = tampered.length - 1;
    tampered[last] = (tampered[last] ?? 0) ^ 0xff;
    expect(() =>
      decryptRegisteredDatabaseUrl(tampered.toString("base64")),
    ).toThrow();
  });
});
