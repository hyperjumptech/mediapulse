/** @vitest-environment node */

import { afterEach, describe, expect, it, vi } from "vitest";
import { HTTPError } from "got";
import { z } from "zod";

import { parseRetryAfterMs, retryAfterDelayMs, retryFetch } from "./retry";
import { mockRateLimiter } from "./test-fixtures";
import type { ProviderRequestContext } from "./types";

const retryConfig = { maxAttempts: 3, baseDelayMs: 1000, maxDelayMs: 8000 };

/**
 * Builds a minimal {@link HTTPError} that exposes `response.statusCode` and
 * `response.headers`, mirroring Got's internal request/response wiring.
 */
function createTestHttpError(
  statusCode: number,
  headers: Record<string, string> = {},
): HTTPError {
  const plainResponse: Record<string, unknown> = {
    statusCode,
    statusMessage: "Error",
    headers,
    requestUrl: new URL("http://example.test"),
    redirectUrls: [],
    isFromCache: false,
    url: "http://example.test",
    timings: {},
    retryCount: 0,
    ok: false,
  };
  plainResponse.request = {
    _onResponse: () => {
      /* noop — satisfies Got's request probe */
    },
    options: { method: "GET", url: new URL("http://example.test") },
    response: plainResponse,
  };

  return new HTTPError(
    plainResponse as unknown as ConstructorParameters<typeof HTTPError>[0],
  );
}

/** Builds a provider context whose rate limiter records responses via a spy. */
const buildContext = (): ProviderRequestContext =>
  ({
    rateLimiter: mockRateLimiter(),
    logger: { info: vi.fn(), warn: vi.fn() },
  }) as unknown as ProviderRequestContext;

describe("parseRetryAfterMs", () => {
  it("parses delta-seconds into milliseconds", () => {
    expect(parseRetryAfterMs("2")).toBe(2000);
  });

  it("returns null for missing or blank values", () => {
    expect(parseRetryAfterMs(undefined)).toBeNull();
    expect(parseRetryAfterMs("")).toBeNull();
    expect(parseRetryAfterMs("   ")).toBeNull();
  });

  it("returns null for unparseable values", () => {
    expect(parseRetryAfterMs("soon")).toBeNull();
  });

  it("parses a future HTTP-date into a positive delta", () => {
    const now = () => Date.parse("2026-01-01T00:00:00.000Z");

    expect(parseRetryAfterMs("Thu, 01 Jan 2026 00:00:03 GMT", now)).toBe(3000);
  });

  it("clamps a past HTTP-date to zero", () => {
    const now = () => Date.parse("2026-01-01T00:00:10.000Z");

    expect(parseRetryAfterMs("Thu, 01 Jan 2026 00:00:00 GMT", now)).toBe(0);
  });
});

describe("retryAfterDelayMs", () => {
  it("honors a Retry-After header under the cap", () => {
    const error = createTestHttpError(429, { "retry-after": "2" });

    expect(retryAfterDelayMs(1, error, retryConfig)).toBe(2000);
  });

  it("caps an oversized Retry-After header", () => {
    const error = createTestHttpError(429, { "retry-after": "100" });

    expect(retryAfterDelayMs(1, error, retryConfig)).toBe(8000);
  });

  it("falls back to exponential backoff without a Retry-After header", () => {
    const error = createTestHttpError(429);

    expect(retryAfterDelayMs(1, error, retryConfig)).toBe(1000);
    expect(retryAfterDelayMs(2, error, retryConfig)).toBe(2000);
    expect(retryAfterDelayMs(3, error, retryConfig)).toBe(4000);
  });

  it("uses exponential backoff for non-HTTP errors", () => {
    expect(retryAfterDelayMs(1, new Error("boom"), retryConfig)).toBe(1000);
  });
});

describe("retryFetch", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("retries a transient failure and returns the eventual success", async () => {
    const ctx = buildContext();
    const task = vi
      .fn()
      .mockRejectedValueOnce(createTestHttpError(429, { "retry-after": "0" }))
      .mockResolvedValueOnce("ok");

    const result = await retryFetch(task, retryConfig, ctx);

    expect(result).toBe("ok");
    expect(task).toHaveBeenCalledTimes(2);
    expect(ctx.rateLimiter.recordResponse).toHaveBeenCalledWith(429);
    expect(ctx.rateLimiter.recordResponse).toHaveBeenCalledTimes(1);
  });

  it("throws immediately on a non-retryable error", async () => {
    const ctx = buildContext();
    const task = vi.fn().mockRejectedValue(new z.ZodError([]));

    await expect(retryFetch(task, retryConfig, ctx)).rejects.toBeInstanceOf(
      z.ZodError,
    );
    expect(task).toHaveBeenCalledTimes(1);
    expect(ctx.rateLimiter.recordResponse).not.toHaveBeenCalled();
  });

  it("gives up after maxAttempts", async () => {
    const ctx = buildContext();
    const task = vi
      .fn()
      .mockRejectedValue(createTestHttpError(429, { "retry-after": "0" }));

    await expect(retryFetch(task, retryConfig, ctx)).rejects.toBeInstanceOf(
      HTTPError,
    );
    expect(task).toHaveBeenCalledTimes(3);
    expect(ctx.rateLimiter.recordResponse).toHaveBeenCalledTimes(2);
  });
});
