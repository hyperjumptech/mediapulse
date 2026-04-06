/** @vitest-environment node */
import { describe, expect, it } from "vitest";
import {
  checkMemorySlidingRateLimit,
  resetMemorySlidingRateLimitForTests,
} from "./memory-sliding-rate-limit";

describe("checkMemorySlidingRateLimit", () => {
  it("allows up to max events in the window", () => {
    resetMemorySlidingRateLimitForTests();
    const now = 1_000_000;
    const clock = { now: () => now };
    expect(
      checkMemorySlidingRateLimit("k", {
        windowMs: 10_000,
        max: 2,
        now: clock.now,
      }),
    ).toBe(true);
    expect(
      checkMemorySlidingRateLimit("k", {
        windowMs: 10_000,
        max: 2,
        now: clock.now,
      }),
    ).toBe(true);
    expect(
      checkMemorySlidingRateLimit("k", {
        windowMs: 10_000,
        max: 2,
        now: clock.now,
      }),
    ).toBe(false);
  });

  it("drops events older than the window", () => {
    resetMemorySlidingRateLimitForTests();
    let t = 0;
    const now = () => t;
    expect(
      checkMemorySlidingRateLimit("x", { windowMs: 100, max: 1, now }),
    ).toBe(true);
    expect(
      checkMemorySlidingRateLimit("x", { windowMs: 100, max: 1, now }),
    ).toBe(false);
    t = 200;
    expect(
      checkMemorySlidingRateLimit("x", { windowMs: 100, max: 1, now }),
    ).toBe(true);
  });
});
