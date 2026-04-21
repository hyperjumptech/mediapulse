import { afterEach, describe, expect, it, vi } from "vitest";

import type { ResolvedPersistRetryConfig } from "./config-schema.js";
import { persistNewsletterWithRetry } from "./persist-with-retry.js";
import type { NewsletterCreateBody } from "./persist-with-retry.js";

const defaultPersistRetry: ResolvedPersistRetryConfig = {
  maxAttempts: 3,
  baseDelayMs: 100,
  maxDelayMs: 1000,
};

const newsletter: NewsletterCreateBody = {
  subject: "Daily Briefing",
  content: "Markets rose today.",
  tickerId: "ticker-1",
};

describe("persistNewsletterWithRetry", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns result immediately when create succeeds on the first attempt", async () => {
    // Setup
    const createFn = vi.fn().mockResolvedValue({ message: "ok" });
    const sleepFn = vi.fn().mockResolvedValue(undefined);

    // Act
    const result = await persistNewsletterWithRetry(
      createFn,
      newsletter,
      defaultPersistRetry,
      { sleepFn },
    );

    // Assert
    expect(result).toEqual({ message: "ok" });
    expect(createFn).toHaveBeenCalledTimes(1);
    expect(sleepFn).not.toHaveBeenCalled();
  });

  it("succeeds on a later attempt after initial transient failures", async () => {
    // Setup
    const createFn = vi
      .fn()
      .mockRejectedValueOnce(new Error("Agent data API error: 503"))
      .mockResolvedValueOnce({ message: "ok" });
    const sleepFn = vi.fn().mockResolvedValue(undefined);

    // Act
    const result = await persistNewsletterWithRetry(
      createFn,
      newsletter,
      defaultPersistRetry,
      { sleepFn },
    );

    // Assert
    expect(result).toEqual({ message: "ok" });
    expect(createFn).toHaveBeenCalledTimes(2);
    expect(sleepFn).toHaveBeenCalledTimes(1);
  });

  it("retries up to maxAttempts on transient 5xx errors and then throws", async () => {
    // Setup
    const createFn = vi
      .fn()
      .mockRejectedValue(new Error("Agent data API error: 503"));
    const sleepFn = vi.fn().mockResolvedValue(undefined);

    // Act & Assert
    await expect(
      persistNewsletterWithRetry(createFn, newsletter, defaultPersistRetry, {
        sleepFn,
      }),
    ).rejects.toThrow("Agent data API error: 503");

    expect(createFn).toHaveBeenCalledTimes(3);
    expect(sleepFn).toHaveBeenCalledTimes(2);
  });

  it("stops after exactly 1 attempt when the error is a non-retryable 400", async () => {
    // Setup
    const createFn = vi
      .fn()
      .mockRejectedValue(new Error("Agent data API error: 400"));
    const sleepFn = vi.fn().mockResolvedValue(undefined);

    // Act & Assert
    await expect(
      persistNewsletterWithRetry(createFn, newsletter, defaultPersistRetry, {
        sleepFn,
      }),
    ).rejects.toThrow("Agent data API error: 400");

    expect(createFn).toHaveBeenCalledTimes(1);
    expect(sleepFn).not.toHaveBeenCalled();
  });

  it("stops after exactly 1 attempt when the error is a non-retryable 401", async () => {
    // Setup
    const createFn = vi
      .fn()
      .mockRejectedValue(new Error("Agent data API error: 401"));
    const sleepFn = vi.fn().mockResolvedValue(undefined);

    // Act & Assert
    await expect(
      persistNewsletterWithRetry(createFn, newsletter, defaultPersistRetry, {
        sleepFn,
      }),
    ).rejects.toThrow("Agent data API error: 401");

    expect(createFn).toHaveBeenCalledTimes(1);
    expect(sleepFn).not.toHaveBeenCalled();
  });

  it("uses no jitter — delay is deterministic exponential backoff", async () => {
    // Setup
    const sleepMs: number[] = [];
    const sleepFn = vi.fn().mockImplementation(async (ms: number) => {
      sleepMs.push(ms);
    });
    const createFn = vi
      .fn()
      .mockRejectedValueOnce(new Error("Agent data API error: 500"))
      .mockRejectedValueOnce(new Error("Agent data API error: 500"))
      .mockRejectedValue(new Error("Agent data API error: 500"));

    const config: ResolvedPersistRetryConfig = {
      maxAttempts: 3,
      baseDelayMs: 50,
      maxDelayMs: 1000,
    };

    // Act & Assert
    await expect(
      persistNewsletterWithRetry(createFn, newsletter, config, { sleepFn }),
    ).rejects.toThrow("Agent data API error: 500");

    // No jitter — delays are deterministic: 50, 100 (baseDelayMs * 2^attempt-1)
    expect(sleepMs).toHaveLength(2);
    expect(sleepMs[0]).toBe(50);
    expect(sleepMs[1]).toBe(100);
  });

  it("caps delay at maxDelayMs", async () => {
    // Setup
    const sleepMs: number[] = [];
    const sleepFn = vi.fn().mockImplementation(async (ms: number) => {
      sleepMs.push(ms);
    });
    const createFn = vi
      .fn()
      .mockRejectedValue(new Error("Agent data API error: 503"));

    const config: ResolvedPersistRetryConfig = {
      maxAttempts: 5,
      baseDelayMs: 500,
      maxDelayMs: 1000,
    };

    // Act & Assert
    await expect(
      persistNewsletterWithRetry(createFn, newsletter, config, { sleepFn }),
    ).rejects.toThrow("Agent data API error: 503");

    // Delays: 500, 1000 (capped), 1000 (capped), 1000 (capped)
    expect(sleepMs).toHaveLength(4);
    expect(sleepMs[0]).toBe(500);
    expect(sleepMs[1]).toBe(1000);
    expect(sleepMs[2]).toBe(1000);
    expect(sleepMs[3]).toBe(1000);
  });

  it("passes newsletter body to createFn on each attempt", async () => {
    // Setup
    const createFn = vi
      .fn()
      .mockRejectedValueOnce(new Error("Agent data API error: 503"))
      .mockResolvedValueOnce({ id: "123" });
    const sleepFn = vi.fn().mockResolvedValue(undefined);

    const body: NewsletterCreateBody = {
      subject: "Test Subject",
      content: "Test content",
      description: "Test description",
      tickerId: "ticker-42",
    };

    // Act
    await persistNewsletterWithRetry(createFn, body, defaultPersistRetry, {
      sleepFn,
    });

    // Assert — createFn receives the same body on every call
    expect(createFn).toHaveBeenCalledTimes(2);
    expect(createFn).toHaveBeenNthCalledWith(1, body);
    expect(createFn).toHaveBeenNthCalledWith(2, body);
  });
});
