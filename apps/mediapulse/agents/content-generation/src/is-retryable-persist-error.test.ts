import { describe, expect, it } from "vitest";

import { isRetryablePersistError } from "./is-retryable-persist-error.js";

describe("isRetryablePersistError", () => {
  describe("transient errors (429 and 5xx)", () => {
    it("classifies 429 as retryable", () => {
      // Act
      const result = isRetryablePersistError(
        new Error("Agent data API error: 429"),
      );

      // Assert
      expect(result).toBe(true);
    });

    it("classifies 500 as retryable", () => {
      // Act
      const result = isRetryablePersistError(
        new Error("Agent data API error: 500"),
      );

      // Assert
      expect(result).toBe(true);
    });

    it("classifies 502 as retryable", () => {
      // Act
      const result = isRetryablePersistError(
        new Error("Agent data API error: 502"),
      );

      // Assert
      expect(result).toBe(true);
    });

    it("classifies 503 as retryable", () => {
      // Act
      const result = isRetryablePersistError(
        new Error("Agent data API error: 503"),
      );

      // Assert
      expect(result).toBe(true);
    });
  });

  describe("client errors (4xx except 429)", () => {
    it("classifies 400 as non-retryable", () => {
      // Act
      const result = isRetryablePersistError(
        new Error("Agent data API error: 400"),
      );

      // Assert
      expect(result).toBe(false);
    });

    it("classifies 401 as non-retryable", () => {
      // Act
      const result = isRetryablePersistError(
        new Error("Agent data API error: 401"),
      );

      // Assert
      expect(result).toBe(false);
    });

    it("classifies 403 as non-retryable", () => {
      // Act
      const result = isRetryablePersistError(
        new Error("Agent data API error: 403"),
      );

      // Assert
      expect(result).toBe(false);
    });

    it("classifies 404 as non-retryable", () => {
      // Act
      const result = isRetryablePersistError(
        new Error("Agent data API error: 404"),
      );

      // Assert
      expect(result).toBe(false);
    });

    it("classifies 422 as non-retryable", () => {
      // Act
      const result = isRetryablePersistError(
        new Error("Agent data API error: 422"),
      );

      // Assert
      expect(result).toBe(false);
    });
  });

  describe("network-level errors (no status code)", () => {
    it("classifies error without status code as retryable (network transient)", () => {
      // Act
      const result = isRetryablePersistError(new Error("Network failure"));

      // Assert
      expect(result).toBe(true);
    });

    it("classifies ECONNREFUSED-style error as retryable", () => {
      // Act
      const result = isRetryablePersistError(
        new Error("connect ECONNREFUSED 127.0.0.1:8081"),
      );

      // Assert
      expect(result).toBe(true);
    });
  });

  describe("abort and timeout errors", () => {
    it("classifies AbortError as retryable", () => {
      // Setup
      const err = new Error("The operation was aborted");
      err.name = "AbortError";

      // Act
      const result = isRetryablePersistError(err);

      // Assert
      expect(result).toBe(true);
    });

    it("classifies TimeoutError as retryable", () => {
      // Setup
      const err = new Error("The operation timed out");
      err.name = "TimeoutError";

      // Act
      const result = isRetryablePersistError(err);

      // Assert
      expect(result).toBe(true);
    });
  });

  describe("non-Error thrown values", () => {
    it("classifies string error as non-retryable", () => {
      // Act & Assert
      expect(isRetryablePersistError("string error")).toBe(false);
    });

    it("classifies null as non-retryable", () => {
      // Act & Assert
      expect(isRetryablePersistError(null)).toBe(false);
    });

    it("classifies undefined as non-retryable", () => {
      // Act & Assert
      expect(isRetryablePersistError(undefined)).toBe(false);
    });

    it("classifies number as non-retryable", () => {
      // Act & Assert
      expect(isRetryablePersistError(42)).toBe(false);
    });
  });
});
