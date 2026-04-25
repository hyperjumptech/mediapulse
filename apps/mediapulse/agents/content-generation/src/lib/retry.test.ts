import { afterEach, describe, expect, it, vi } from "vitest";

import { expBackoffWithJitter, retryWithBackoff } from "./retry.js";

describe("expBackoffWithJitter", () => {
  it("returns baseDelayMs on the first failure attempt without jitter", () => {
    // Act
    const delay = expBackoffWithJitter(1, {
      baseDelayMs: 100,
      maxDelayMs: 10_000,
      jitter: false,
    });

    // Assert
    expect(delay).toBe(100);
  });

  it("doubles the delay on each subsequent attempt without jitter", () => {
    // Setup
    const config = { baseDelayMs: 100, maxDelayMs: 10_000, jitter: false };

    // Act
    const d1 = expBackoffWithJitter(1, config);
    const d2 = expBackoffWithJitter(2, config);
    const d3 = expBackoffWithJitter(3, config);

    // Assert
    expect(d1).toBe(100);
    expect(d2).toBe(200);
    expect(d3).toBe(400);
  });

  it("caps delay at maxDelayMs without jitter", () => {
    // Act
    const delay = expBackoffWithJitter(10, {
      baseDelayMs: 500,
      maxDelayMs: 1_000,
      jitter: false,
    });

    // Assert
    expect(delay).toBe(1_000);
  });

  it("applies jitter so delay stays within [0.5 × base, 1.5 × base]", () => {
    // Setup
    const config = { baseDelayMs: 1_000, maxDelayMs: 10_000, jitter: true };
    const expectedBase = 1_000;

    // Act & Assert — run many iterations to cover the range
    for (let i = 0; i < 100; i++) {
      const delay = expBackoffWithJitter(1, config);
      expect(delay).toBeGreaterThanOrEqual(Math.floor(expectedBase * 0.5));
      expect(delay).toBeLessThanOrEqual(expectedBase * 1.5);
    }
  });

  it("caps jittered delay at maxDelayMs", () => {
    // Setup — force the maximum possible random value (0.999…)
    const alwaysMax = () => 0.999;
    const config = { baseDelayMs: 800, maxDelayMs: 1_000, jitter: true };

    // Act
    const delay = expBackoffWithJitter(1, config, alwaysMax);

    // Assert
    expect(delay).toBeLessThanOrEqual(1_000);
  });

  it("uses the injected random function for deterministic output", () => {
    // Setup — constant random returns 0.5 → jitterFactor = 1.0 → delay = base
    const constantRandom = () => 0.5;
    const config = { baseDelayMs: 200, maxDelayMs: 10_000, jitter: true };

    // Act
    const delay = expBackoffWithJitter(1, config, constantRandom);

    // Assert — 0.5 + 0.5 = 1.0 × 200 = 200
    expect(delay).toBe(200);
  });
});

describe("retryWithBackoff", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns result immediately when task succeeds on the first attempt", async () => {
    // Setup
    const task = vi.fn().mockResolvedValue("ok");
    const sleepFn = vi.fn().mockResolvedValue(undefined);

    // Act
    const result = await retryWithBackoff(
      task,
      { maxAttempts: 3, baseDelayMs: 10, maxDelayMs: 100, jitter: false },
      () => true,
      { sleepFn },
    );

    // Assert
    expect(result).toBe("ok");
    expect(task).toHaveBeenCalledTimes(1);
    expect(sleepFn).not.toHaveBeenCalled();
  });

  it("retries up to maxAttempts on retryable errors and then throws", async () => {
    // Setup
    const err = new Error("transient");
    const task = vi.fn().mockRejectedValue(err);
    const sleepFn = vi.fn().mockResolvedValue(undefined);

    // Act & Assert
    await expect(
      retryWithBackoff(
        task,
        { maxAttempts: 3, baseDelayMs: 10, maxDelayMs: 100, jitter: false },
        () => true,
        { sleepFn },
      ),
    ).rejects.toThrow("transient");

    expect(task).toHaveBeenCalledTimes(3);
    expect(sleepFn).toHaveBeenCalledTimes(2); // sleep between attempts 1→2 and 2→3
  });

  it("stops after exactly 1 attempt when the error is non-retryable", async () => {
    // Setup
    const err = new Error("fatal");
    const task = vi.fn().mockRejectedValue(err);
    const sleepFn = vi.fn().mockResolvedValue(undefined);

    // Act & Assert
    await expect(
      retryWithBackoff(
        task,
        { maxAttempts: 3, baseDelayMs: 10, maxDelayMs: 100, jitter: false },
        () => false,
        { sleepFn },
      ),
    ).rejects.toThrow("fatal");

    expect(task).toHaveBeenCalledTimes(1);
    expect(sleepFn).not.toHaveBeenCalled();
  });

  it("succeeds on a later attempt after initial failures", async () => {
    // Setup
    const task = vi
      .fn()
      .mockRejectedValueOnce(new Error("first failure"))
      .mockRejectedValueOnce(new Error("second failure"))
      .mockResolvedValueOnce("success");
    const sleepFn = vi.fn().mockResolvedValue(undefined);

    // Act
    const result = await retryWithBackoff(
      task,
      { maxAttempts: 5, baseDelayMs: 10, maxDelayMs: 100, jitter: false },
      () => true,
      { sleepFn },
    );

    // Assert
    expect(result).toBe("success");
    expect(task).toHaveBeenCalledTimes(3);
  });

  it("passes a custom sleepFn so tests do not incur real delays", async () => {
    // Setup
    const sleepMs: number[] = [];
    const sleepFn = vi.fn().mockImplementation(async (ms: number) => {
      sleepMs.push(ms);
    });
    const task = vi
      .fn()
      .mockRejectedValueOnce(new Error("err"))
      .mockResolvedValueOnce("done");

    // Act
    await retryWithBackoff(
      task,
      { maxAttempts: 2, baseDelayMs: 50, maxDelayMs: 1_000, jitter: false },
      () => true,
      { sleepFn },
    );

    // Assert — exactly one sleep of 50 ms (baseDelayMs on attempt 1)
    expect(sleepMs).toHaveLength(1);
    expect(sleepMs[0]).toBe(50);
  });
});
