/** @vitest-environment node */

import { describe, expect, it } from "vitest";

import { RateLimiter } from "./resilience";

describe("RateLimiter adaptive backoff", () => {
  it("grows the window after provider stress and decays after clean successes", () => {
    // Setup
    const limiter = new RateLimiter(2, 1);
    const baselineWindowMs = 1000;

    // Act
    limiter.recordResponse(429);
    const after429 = limiter.getWindowMs();
    limiter.recordResponse(200);
    limiter.recordResponse(200);
    const afterCooldown = limiter.getWindowMs();
    for (let index = 0; index < 10; index += 1) {
      limiter.recordResponse(200);
    }
    const afterDecay = limiter.getWindowMs();

    // Assert
    expect(after429).toBe(1500);
    expect(afterCooldown).toBe(after429);
    expect(afterDecay).toBeLessThan(after429);
    expect(afterDecay).toBeGreaterThanOrEqual(baselineWindowMs);
    expect(limiter.getThrottleEvents()).toBe(1);
  });

  it("caps adaptive window growth at four times the baseline", () => {
    // Setup
    const limiter = new RateLimiter(2, 1);
    const baselineWindowMs = 1000;

    // Act
    for (let index = 0; index < 10; index += 1) {
      limiter.recordResponse(503);
    }

    // Assert
    expect(limiter.getWindowMs()).toBe(baselineWindowMs * 4);
  });
});
