/** @vitest-environment node */

import { afterEach, describe, expect, it, vi } from "vitest";

import { RateLimiter, withRetry } from "./resilience";

describe("RateLimiter", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("blocks until the window advances when the limit is exceeded", async () => {
    // Setup
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2020-01-01T00:00:00.000Z"));
    const limiter = new RateLimiter(1, 1);

    // Act
    await limiter.acquire();
    const pending = limiter.acquire();
    await vi.advanceTimersByTimeAsync(1000);

    // Assert
    await expect(pending).resolves.toBeUndefined();
  });
});

describe("withRetry", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("returns the task result on first success", async () => {
    // Setup
    const task = vi.fn().mockResolvedValue(42);
    const retryConfig = {
      maxAttempts: 3,
      baseDelayMs: 5,
      maxDelayMs: 50,
    };

    // Act
    const result = await withRetry(task, retryConfig, () => true);

    // Assert
    expect(result).toBe(42);
    expect(task).toHaveBeenCalledTimes(1);
  });

  it("retries when the predicate allows and eventually succeeds", async () => {
    // Setup
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const task = vi
      .fn()
      .mockRejectedValueOnce(new Error("transient"))
      .mockResolvedValueOnce("ok");
    const retryConfig = {
      maxAttempts: 3,
      baseDelayMs: 10,
      maxDelayMs: 100,
    };

    // Act
    const pending = withRetry(task, retryConfig, () => true);
    await vi.runAllTimersAsync();
    const result = await pending;

    // Assert
    expect(result).toBe("ok");
    expect(task).toHaveBeenCalledTimes(2);
  });

  it("throws immediately when the error is not retryable", async () => {
    // Setup
    const err = new Error("fatal");
    const task = vi.fn().mockRejectedValue(err);

    // Act
    const pending = withRetry(
      task,
      { maxAttempts: 3, baseDelayMs: 10, maxDelayMs: 100 },
      () => false,
    );

    // Assert
    await expect(pending).rejects.toThrow("fatal");
    expect(task).toHaveBeenCalledTimes(1);
  });

  it("throws after exhausting retry attempts", async () => {
    // Setup
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const err = new Error("always");
    const task = vi.fn().mockRejectedValue(err);
    const retryConfig = {
      maxAttempts: 2,
      baseDelayMs: 10,
      maxDelayMs: 100,
    };

    // Act
    const pending = withRetry(task, retryConfig, () => true);
    const assertion = expect(pending).rejects.toThrow("always");
    await vi.runAllTimersAsync();

    // Assert
    await assertion;
    expect(task).toHaveBeenCalledTimes(2);
  });
});
