import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getBackoffDelayMs,
  REGISTRATION_INITIAL_DELAY_MS,
  REGISTRATION_MAX_DELAY_MS,
  shouldRetryStatus,
  sleep,
} from "./registration-retry";

describe("getBackoffDelayMs", () => {
  it("doubles exponentially per attempt and caps at REGISTRATION_MAX_DELAY_MS", () => {
    // Act
    const first = getBackoffDelayMs(1);
    const second = getBackoffDelayMs(2);
    const huge = getBackoffDelayMs(99);

    // Assert
    expect(first).toBe(REGISTRATION_INITIAL_DELAY_MS);
    expect(second).toBe(REGISTRATION_INITIAL_DELAY_MS * 2);
    expect(huge).toBe(REGISTRATION_MAX_DELAY_MS);
  });
});

describe("shouldRetryStatus", () => {
  it("returns true for rate limit and 5xx responses", () => {
    // Act & Assert
    expect(shouldRetryStatus(429)).toBe(true);
    expect(shouldRetryStatus(500)).toBe(true);
    expect(shouldRetryStatus(503)).toBe(true);
  });

  it("returns false for typical success and client errors", () => {
    // Act & Assert
    expect(shouldRetryStatus(200)).toBe(false);
    expect(shouldRetryStatus(400)).toBe(false);
    expect(shouldRetryStatus(499)).toBe(false);
  });
});

describe("sleep", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("resolves after the requested delay", async () => {
    // Setup
    vi.useFakeTimers();
    const promise = sleep(1_000);

    // Act
    await vi.advanceTimersByTimeAsync(1_000);

    // Assert
    await expect(promise).resolves.toBeUndefined();
  });
});
