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

  describe("edge cases", () => {
    it("classifies errors without status code as persist_client_error", () => {
      // Act
      const code = classifyPersistError(new Error("Network failure"));

      // Assert
      expect(code).toBe("persist_client_error");
    });

    it("classifies non-Error thrown values as persist_client_error", () => {
      // Act & Assert
      expect(classifyPersistError("string error")).toBe("persist_client_error");
      expect(classifyPersistError(null)).toBe("persist_client_error");
      expect(classifyPersistError(undefined)).toBe("persist_client_error");
      expect(classifyPersistError(42)).toBe("persist_client_error");
    });
  });
});
