/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createTokenHint,
  hashHttpTriggerToken,
  verifyHttpTriggerToken,
} from "./http-trigger-auth";

describe("http-trigger-auth", () => {
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
});
