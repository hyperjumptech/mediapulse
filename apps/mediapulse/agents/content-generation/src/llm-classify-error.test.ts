import { APICallError, NoObjectGeneratedError, TypeValidationError } from "ai";
import { afterEach, describe, expect, it, vi } from "vitest";

import { classifyLlmError, isRetryableLlmError } from "./llm-classify-error.js";

afterEach(() => {
  vi.restoreAllMocks();
});

/**
 * Constructs a minimal APICallError for test scenarios.
 */
function makeApiCallError({
  statusCode,
  isRetryable,
}: {
  statusCode: number;
  isRetryable: boolean;
}): APICallError {
  return new APICallError({
    message: `HTTP ${statusCode}`,
    url: "https://api.openai.com/v1/chat/completions",
    requestBodyValues: {},
    statusCode,
    isRetryable,
  });
}

function makeTypeValidationError(): TypeValidationError {
  return new TypeValidationError({
    value: { bad: "shape" },
    cause: new Error("Schema validation failed"),
  });
}

function makeNoObjectGeneratedError(): NoObjectGeneratedError {
  // Use Object.create to avoid constructing the complex required args
  // (response, usage) that are only needed at runtime, not for instanceof checks.
  return Object.assign(
    Object.create(NoObjectGeneratedError.prototype) as NoObjectGeneratedError,
    { message: "No object generated", name: "AI_NoObjectGeneratedError" },
  );
}

function makeAbortError(name: "AbortError" | "TimeoutError"): Error {
  const err = new Error(name);
  err.name = name;
  return err;
}

// ---------------------------------------------------------------------------
// isRetryableLlmError
// ---------------------------------------------------------------------------

describe("isRetryableLlmError", () => {
  it("returns true for APICallError with isRetryable: true (e.g. 429)", () => {
    // Setup
    const error = makeApiCallError({ statusCode: 429, isRetryable: true });

    // Act
    const result = isRetryableLlmError(error);

    // Assert
    expect(result).toBe(true);
  });

  it("returns true for APICallError with isRetryable: true (e.g. 503)", () => {
    // Setup
    const error = makeApiCallError({ statusCode: 503, isRetryable: true });

    // Act & Assert
    expect(isRetryableLlmError(error)).toBe(true);
  });

  it("returns false for APICallError with isRetryable: false (e.g. 401)", () => {
    // Setup
    const error = makeApiCallError({ statusCode: 401, isRetryable: false });

    // Act & Assert
    expect(isRetryableLlmError(error)).toBe(false);
  });

  it("returns false for APICallError with isRetryable: false (e.g. 400)", () => {
    // Setup
    const error = makeApiCallError({ statusCode: 400, isRetryable: false });

    // Act & Assert
    expect(isRetryableLlmError(error)).toBe(false);
  });

  it("returns false for TypeValidationError", () => {
    // Setup
    const error = makeTypeValidationError();

    // Act & Assert
    expect(isRetryableLlmError(error)).toBe(false);
  });

  it("returns false for NoObjectGeneratedError", () => {
    // Setup
    const error = makeNoObjectGeneratedError();

    // Act & Assert
    expect(isRetryableLlmError(error)).toBe(false);
  });

  it("returns true for an AbortError (request aborted)", () => {
    // Setup
    const error = makeAbortError("AbortError");

    // Act & Assert
    expect(isRetryableLlmError(error)).toBe(true);
  });

  it("returns true for a TimeoutError (AbortSignal.timeout fired)", () => {
    // Setup
    const error = makeAbortError("TimeoutError");

    // Act & Assert
    expect(isRetryableLlmError(error)).toBe(true);
  });

  it("returns false for an unknown plain Error", () => {
    // Setup
    const error = new Error("unexpected");

    // Act & Assert
    expect(isRetryableLlmError(error)).toBe(false);
  });

  it("returns true for unknown Error with transient network message", () => {
    // Setup
    const error = new Error("socket hang up");

    // Act & Assert
    expect(isRetryableLlmError(error)).toBe(true);
  });

  it("returns true for unknown Error with 5xx statusCode", () => {
    // Setup
    const error = Object.assign(new Error("upstream failed"), {
      statusCode: 503,
    });

    // Act & Assert
    expect(isRetryableLlmError(error)).toBe(true);
  });

  it("returns false for a non-Error thrown value", () => {
    // Act & Assert
    expect(isRetryableLlmError("string error")).toBe(false);
    expect(isRetryableLlmError(null)).toBe(false);
    expect(isRetryableLlmError(42)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// classifyLlmError
// ---------------------------------------------------------------------------

describe("classifyLlmError", () => {
  it("maps TypeValidationError to validation_failed", () => {
    // Setup
    const error = makeTypeValidationError();

    // Act
    const code = classifyLlmError(error);

    // Assert
    expect(code).toBe("validation_failed");
  });

  it("maps NoObjectGeneratedError to openai_invalid_response", () => {
    // Setup
    const error = makeNoObjectGeneratedError();

    // Act
    const code = classifyLlmError(error);

    // Assert
    expect(code).toBe("openai_invalid_response");
  });

  it("maps retryable APICallError (429) to openai_retry_exhausted", () => {
    // Setup
    const error = makeApiCallError({ statusCode: 429, isRetryable: true });

    // Act
    const code = classifyLlmError(error);

    // Assert
    expect(code).toBe("openai_retry_exhausted");
  });

  it("maps retryable APICallError (500) to openai_retry_exhausted", () => {
    // Setup
    const error = makeApiCallError({ statusCode: 500, isRetryable: true });

    // Act & Assert
    expect(classifyLlmError(error)).toBe("openai_retry_exhausted");
  });

  it("maps non-retryable APICallError (401) to openai_non_retryable", () => {
    // Setup
    const error = makeApiCallError({ statusCode: 401, isRetryable: false });

    // Act
    const code = classifyLlmError(error);

    // Assert
    expect(code).toBe("openai_non_retryable");
  });

  it("maps non-retryable APICallError (400) to openai_non_retryable", () => {
    // Setup
    const error = makeApiCallError({ statusCode: 400, isRetryable: false });

    // Act & Assert
    expect(classifyLlmError(error)).toBe("openai_non_retryable");
  });

  it("maps AbortError to openai_retry_exhausted", () => {
    // Setup
    const error = makeAbortError("AbortError");

    // Act
    const code = classifyLlmError(error);

    // Assert
    expect(code).toBe("openai_retry_exhausted");
  });

  it("maps TimeoutError to openai_retry_exhausted", () => {
    // Setup
    const error = makeAbortError("TimeoutError");

    // Act & Assert
    expect(classifyLlmError(error)).toBe("openai_retry_exhausted");
  });

  it("maps an unknown Error to openai_non_retryable", () => {
    // Setup
    const error = new Error("unknown");

    // Act
    const code = classifyLlmError(error);

    // Assert
    expect(code).toBe("openai_non_retryable");
  });

  it("maps unknown transient network Error to openai_retry_exhausted", () => {
    // Setup
    const error = new Error("network error: socket hang up");

    // Act
    const code = classifyLlmError(error);

    // Assert
    expect(code).toBe("openai_retry_exhausted");
  });

  it("maps unknown Error with 5xx statusCode to openai_retry_exhausted", () => {
    // Setup
    const error = Object.assign(new Error("server error"), { statusCode: 500 });

    // Act
    const code = classifyLlmError(error);

    // Assert
    expect(code).toBe("openai_retry_exhausted");
  });

  it("maps a non-Error thrown value to openai_non_retryable", () => {
    // Act & Assert
    expect(classifyLlmError("raw string")).toBe("openai_non_retryable");
    expect(classifyLlmError(undefined)).toBe("openai_non_retryable");
  });
});
