import { describe, expect, it } from "vitest";

import { createSendRateLimiter } from "./rate-limiter";

describe("createSendRateLimiter", () => {
  it("returns 0 wait when first acquire and no cap hit", async () => {
    let t = 1_000_000;
    const clock = { now: () => t };
    const limiter = createSendRateLimiter({
      minIntervalMs: 100,
      maxSendsPerMinute: 10,
      clock,
    });
    const w = await limiter.acquire();
    expect(w).toBe(0);
  });
});
