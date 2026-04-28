import { describe, expect, it } from "vitest";

import { classifyPersistError } from "./classify-persist-error.js";

describe("classifyPersistError", () => {
  describe("transient errors (429 and 5xx)", () => {
    it("classifies 429 as persist_transient", () => {
      // Act
      const code = classifyPersistError(new Error("Agent data API error: 429"));

      // Assert
      expect(code).toBe("persist_transient");
    });

    it("classifies 500 as persist_transient", () => {
      // Act
      const code = classifyPersistError(new Error("Agent data API error: 500"));

      // Assert
      expect(code).toBe("persist_transient");
    });

    it("classifies 502 as persist_transient", () => {
      // Act
      const code = classifyPersistError(new Error("Agent data API error: 502"));

      // Assert
      expect(code).toBe("persist_transient");
    });

    it("classifies 503 as persist_transient", () => {
      // Act
      const code = classifyPersistError(new Error("Agent data API error: 503"));

      // Assert
      expect(code).toBe("persist_transient");
    });
  });

  describe("client errors (4xx except 429)", () => {
    it("classifies 400 as persist_client_error", () => {
      // Act
      const code = classifyPersistError(new Error("Agent data API error: 400"));

      // Assert
      expect(code).toBe("persist_client_error");
    });

    it("classifies 401 as persist_client_error", () => {
      // Act
      const code = classifyPersistError(new Error("Agent data API error: 401"));

      // Assert
      expect(code).toBe("persist_client_error");
    });

    it("classifies 403 as persist_client_error", () => {
      // Act
      const code = classifyPersistError(new Error("Agent data API error: 403"));

      // Assert
      expect(code).toBe("persist_client_error");
    });

    it("classifies 404 as persist_client_error", () => {
      // Act
      const code = classifyPersistError(new Error("Agent data API error: 404"));

      // Assert
      expect(code).toBe("persist_client_error");
    });

    it("classifies 422 as persist_client_error", () => {
      // Act
      const code = classifyPersistError(new Error("Agent data API error: 422"));

      // Assert
      expect(code).toBe("persist_client_error");
    });
  });

  describe("network-level errors (no parseable status code)", () => {
    it("classifies error without status code as persist_transient", () => {
      // Act
      const code = classifyPersistError(new Error("Network failure"));

      // Assert
      expect(code).toBe("persist_transient");
    });

    it("classifies ECONNREFUSED-style error as persist_transient", () => {
      // Act
      const code = classifyPersistError(
        new Error("connect ECONNREFUSED 127.0.0.1:8081"),
      );

      // Assert
      expect(code).toBe("persist_transient");
    });
  });

  describe("abort and timeout errors", () => {
    it("classifies AbortError as persist_transient", () => {
      // Setup
      const err = new Error("The operation was aborted");
      err.name = "AbortError";

      // Act
      const code = classifyPersistError(err);

      // Assert
      expect(code).toBe("persist_transient");
    });

    it("classifies TimeoutError as persist_transient", () => {
      // Setup
      const err = new Error("The operation timed out");
      err.name = "TimeoutError";

      // Act
      const code = classifyPersistError(err);

      // Assert
      expect(code).toBe("persist_transient");
    });
  });

  describe("non-Error thrown values", () => {
    it("classifies string error as persist_client_error", () => {
      // Act
      const code = classifyPersistError("string error");

      // Assert
      expect(code).toBe("persist_client_error");
    });

    it("classifies null as persist_client_error", () => {
      // Act
      const code = classifyPersistError(null);

      // Assert
      expect(code).toBe("persist_client_error");
    });

    it("classifies undefined as persist_client_error", () => {
      // Act
      const code = classifyPersistError(undefined);

      // Assert
      expect(code).toBe("persist_client_error");
    });

    it("classifies number as persist_client_error", () => {
      // Act
      const code = classifyPersistError(42);

      // Assert
      expect(code).toBe("persist_client_error");
    });
  });
});
