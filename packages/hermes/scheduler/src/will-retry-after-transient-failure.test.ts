import { describe, expect, it } from "vitest";
import { willRetryAfterTransientFailure } from "./will-retry-after-transient-failure";

describe("willRetryAfterTransientFailure", () => {
  it("returns true when attempts are below maxAttempts", () => {
    expect(willRetryAfterTransientFailure(1, 3)).toBe(true);
    expect(willRetryAfterTransientFailure(2, 3)).toBe(true);
  });

  it("returns false when attempts equal maxAttempts (last attempt exhausted)", () => {
    expect(willRetryAfterTransientFailure(3, 3)).toBe(false);
  });

  it("returns false when attempts exceed maxAttempts", () => {
    expect(willRetryAfterTransientFailure(4, 3)).toBe(false);
  });
});
