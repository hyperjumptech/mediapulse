import { afterEach, describe, expect, it, vi } from "vitest";

import { withRetry, withRetryCustomDelay } from "./with-retry.js";

describe("withRetry", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("returns the task result on first success", async () => {
    const task = vi.fn().mockResolvedValue(42);
    const retryConfig = {
      maxAttempts: 3,
      baseDelayMs: 5,
      maxDelayMs: 50,
    };

    const result = await withRetry(task, retryConfig, () => true);

    expect(result).toBe(42);
    expect(task).toHaveBeenCalledTimes(1);
  });

  it("retries when the predicate allows and eventually succeeds", async () => {
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

    const pending = withRetry(task, retryConfig, () => true);
    await vi.runAllTimersAsync();
    const result = await pending;

    expect(result).toBe("ok");
    expect(task).toHaveBeenCalledTimes(2);
  });

  it("throws immediately when the error is not retryable", async () => {
    const err = new Error("fatal");
    const task = vi.fn().mockRejectedValue(err);

    const pending = withRetry(
      task,
      { maxAttempts: 3, baseDelayMs: 10, maxDelayMs: 100 },
      () => false,
    );

    await expect(pending).rejects.toThrow("fatal");
    expect(task).toHaveBeenCalledTimes(1);
  });

  it("throws after exhausting retry attempts", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const err = new Error("always");
    const task = vi.fn().mockRejectedValue(err);
    const retryConfig = {
      maxAttempts: 2,
      baseDelayMs: 10,
      maxDelayMs: 100,
    };

    const pending = withRetry(task, retryConfig, () => true);
    const assertion = expect(pending).rejects.toThrow("always");
    await vi.runAllTimersAsync();

    await assertion;
    expect(task).toHaveBeenCalledTimes(2);
  });
});

describe("withRetryCustomDelay", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("uses getDelayMs between attempts", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const task = vi
      .fn()
      .mockRejectedValueOnce(new Error("a"))
      .mockResolvedValueOnce(1);
    const getDelayMs = vi.fn().mockReturnValue(5);

    const p = withRetryCustomDelay(task, 3, getDelayMs, () => true);
    await vi.runAllTimersAsync();
    await expect(p).resolves.toBe(1);

    expect(getDelayMs).toHaveBeenCalled();
    expect(task).toHaveBeenCalledTimes(2);
  });
});
