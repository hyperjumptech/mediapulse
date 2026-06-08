/** @vitest-environment node */

import { describe, expect, it } from "vitest";
import { HTTPError, RequestError, TimeoutError } from "got";
import { z } from "zod";

import { classifyError, isRetryableError } from "./error-classification";

/**
 * Builds a minimal {@link HTTPError} that mirrors Got’s internal `request`/`response`
 * wiring so `response.statusCode` is visible on the error instance.
 *
 * @param statusCode - HTTP status to attach to the mocked response.
 */
function createTestHttpError(statusCode: number): HTTPError {
  const plainResponse: Record<string, unknown> = {
    statusCode,
    statusMessage: "Error",
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
      /* noop — satisfies Got’s request probe */
    },
    options: { method: "GET", url: new URL("http://example.test") },
    response: plainResponse,
  };
  return new HTTPError(
    plainResponse as unknown as ConstructorParameters<typeof HTTPError>[0],
  );
}

describe("isRetryableError", () => {
  it("returns true for HTTP 429 responses", () => {
    // Setup
    const err = createTestHttpError(429);

    // Act
    const result = isRetryableError(err);

    // Assert
    expect(result).toBe(true);
  });

  it("returns true for HTTP 500 responses", () => {
    // Setup
    const err = createTestHttpError(500);

    // Act
    const result = isRetryableError(err);

    // Assert
    expect(result).toBe(true);
  });

  it("returns false for HTTP 404 responses", () => {
    // Setup
    const err = createTestHttpError(404);

    // Act
    const result = isRetryableError(err);

    // Assert
    expect(result).toBe(false);
  });

  it("returns true for TimeoutError", () => {
    // Setup
    const err = new TimeoutError(
      { message: "timeout", event: "request" } as never,
      {} as never,
      {} as never,
    );

    // Act
    const result = isRetryableError(err);

    // Assert
    expect(result).toBe(true);
  });

  it("returns true for RequestError with a transient network code", () => {
    // Setup
    const err = new RequestError("reset", { code: "ECONNRESET" }, {} as never);

    // Act
    const result = isRetryableError(err);

    // Assert
    expect(result).toBe(true);
  });

  it("returns false for RequestError without a known transient code", () => {
    // Setup
    const err = new RequestError("other", { code: "UNKNOWN" }, {} as never);

    // Act
    const result = isRetryableError(err);

    // Assert
    expect(result).toBe(false);
  });

  it("returns false for unknown error values", () => {
    // Act
    const result = isRetryableError(new Error("plain"));

    // Assert
    expect(result).toBe(false);
  });
});

describe("classifyError", () => {
  it("classifies ZodError as provider_schema_error", () => {
    // Setup
    const err = new z.ZodError([]);

    // Act
    const result = classifyError(err);

    // Assert
    expect(result.category).toBe("provider_schema_error");
    expect(result.httpStatus).toBeUndefined();
  });

  it("classifies HTTPError with status and message", () => {
    // Setup
    const err = createTestHttpError(502);

    // Act
    const result = classifyError(err);

    // Assert
    expect(result.category).toBe("provider_http_error");
    expect(result.httpStatus).toBe(502);
  });

  it("classifies TimeoutError as timeout_error", () => {
    // Setup
    const err = new TimeoutError(
      { message: "timed out", event: "request" } as never,
      {} as never,
      {} as never,
    );

    // Act
    const result = classifyError(err);

    // Assert
    expect(result.category).toBe("timeout_error");
  });

  it("classifies RequestError as network_error", () => {
    // Setup
    const err = new RequestError(
      "network",
      { code: "ECONNREFUSED" },
      {} as never,
    );

    // Act
    const result = classifyError(err);

    // Assert
    expect(result.category).toBe("network_error");
  });

  it("maps semantic validation failures to provider_data_invalid", () => {
    // Setup
    const err = new Error("Semantic validation failed");

    // Act
    const result = classifyError(err);

    // Assert
    expect(result.category).toBe("provider_data_invalid");
    expect(result.message).toBe("Missing required fields in response");
  });

  it("classifies generic Error as internal_processing_error", () => {
    // Setup
    const err = new Error("boom");

    // Act
    const result = classifyError(err);

    // Assert
    expect(result.category).toBe("internal_processing_error");
    expect(result.message).toBe("boom");
  });

  it("stringifies non-Error throws for internal_processing_error", () => {
    // Act
    const result = classifyError("raw");

    // Assert
    expect(result.category).toBe("internal_processing_error");
    expect(result.message).toBe("raw");
  });
});
