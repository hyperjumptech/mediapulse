/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createTokenHint,
  generateHttpTriggerToken,
  hashHttpTriggerToken,
  verifyHttpTriggerToken,
} from "./http-trigger-token";

describe("http-trigger-token", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("hashes token deterministically", () => {
    // Act
    const left = hashHttpTriggerToken("abc123");
    const right = hashHttpTriggerToken("abc123");

    // Assert
    expect(left).toBe(right);
    expect(left).toHaveLength(64);
  });

  it("creates token hint from last four characters", () => {
    // Act
    const hint = createTokenHint("super-secret-token");

    // Assert
    expect(hint).toBe("...oken");
  });

  it("returns null hint for short token", () => {
    // Act
    const hint = createTokenHint("abc");

    // Assert
    expect(hint).toBeNull();
  });

  it("verifies matching token hash", () => {
    // Setup
    const hash = hashHttpTriggerToken("my-token");

    // Act
    const ok = verifyHttpTriggerToken("my-token", hash);

    // Assert
    expect(ok).toBe(true);
  });

  it("rejects non-matching token hash", () => {
    // Setup
    const hash = hashHttpTriggerToken("my-token");

    // Act
    const ok = verifyHttpTriggerToken("other-token", hash);

    // Assert
    expect(ok).toBe(false);
  });

  it("generates distinct url-safe tokens that verify against their own hash", () => {
    const first = generateHttpTriggerToken();
    const second = generateHttpTriggerToken();

    expect(first).not.toBe(second);
    expect(first).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(verifyHttpTriggerToken(first, hashHttpTriggerToken(first))).toBe(
      true,
    );
  });
});
