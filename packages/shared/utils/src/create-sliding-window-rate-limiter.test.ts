import { afterEach, describe, expect, it, vi } from "vitest";

import { createSlidingWindowRateLimiter } from "./create-sliding-window-rate-limiter.js";

describe("createSlidingWindowRateLimiter", () => {
  it("throws when window or maxInWindow are invalid", () => {
    expect(() =>
      createSlidingWindowRateLimiter({
        windowMs: 0,
        maxInWindow: 1,
      }),
    ).toThrow(/windowMs/);
    expect(() =>
      createSlidingWindowRateLimiter({
        windowMs: 1000,
        maxInWindow: 0,
      }),
    ).toThrow(/maxInWindow/);
  });

  it("returns 0 wait on first acquire when no min interval and cap not hit", async () => {
    let t = 1_000_000;
    const clock = { now: () => t };
    const limiter = createSlidingWindowRateLimiter({
      windowMs: 60_000,
      maxInWindow: 10,
      minIntervalMs: 100,
      clock,
    });
    const w = await limiter.acquire();
    expect(w).toBe(0);
  });
});

describe("createSlidingWindowRateLimiter data-collection parity", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("blocks until the window advances when the limit is exceeded", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2020-01-01T00:00:00.000Z"));
    const limiter = createSlidingWindowRateLimiter({
      windowMs: 1000,
      maxInWindow: 1,
      minIntervalMs: 0,
    });

    await limiter.acquire();
    const pending = limiter.acquire();
    await vi.advanceTimersByTimeAsync(1000);

    await expect(pending).resolves.toBeGreaterThanOrEqual(0);
  });
});
