/** @vitest-environment node */
import { describe, expect, it, vi } from "vitest";
import {
  generateHermesAdminResetToken,
  hashHermesAdminResetToken,
} from "./hermes-admin-reset-token";

describe("hashHermesAdminResetToken", () => {
  it("returns stable hex digest for the same input", () => {
    const a = hashHermesAdminResetToken("hello");
    const b = hashHermesAdminResetToken("hello");
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it("returns different digests for different inputs", () => {
    expect(hashHermesAdminResetToken("a")).not.toBe(
      hashHermesAdminResetToken("b"),
    );
  });
});

describe("generateHermesAdminResetToken", () => {
  it("uses injected random bytes", () => {
    const rb = vi.fn().mockReturnValue(Buffer.alloc(32, 1));
    const { rawToken, tokenHash } = generateHermesAdminResetToken(rb);
    expect(rb).toHaveBeenCalledWith(32);
    expect(rawToken).toBe(Buffer.alloc(32, 1).toString("base64url"));
    expect(tokenHash).toBe(hashHermesAdminResetToken(rawToken));
  });
});
