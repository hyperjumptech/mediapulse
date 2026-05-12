import { describe, expect, it } from "vitest";

import { isLogPrettyEnabled } from "./is-log-pretty-enabled.js";

describe("isLogPrettyEnabled", () => {
  it("returns false when LOG_PRETTY is unset", () => {
    // Act
    const result = isLogPrettyEnabled({});

    // Assert
    expect(result).toBe(false);
  });

  it("returns true for LOG_PRETTY=1", () => {
    // Act
    const result = isLogPrettyEnabled({ LOG_PRETTY: "1" });

    // Assert
    expect(result).toBe(true);
  });

  it("returns true for LOG_PRETTY=true", () => {
    // Act
    const result = isLogPrettyEnabled({ LOG_PRETTY: "true" });

    // Assert
    expect(result).toBe(true);
  });

  it("returns true for LOG_PRETTY=TRUE", () => {
    // Act
    const result = isLogPrettyEnabled({ LOG_PRETTY: "TRUE" });

    // Assert
    expect(result).toBe(true);
  });

  it("returns false for other LOG_PRETTY values", () => {
    // Act
    expect(isLogPrettyEnabled({ LOG_PRETTY: "0" })).toBe(false);
    expect(isLogPrettyEnabled({ LOG_PRETTY: "yes" })).toBe(false);
    expect(isLogPrettyEnabled({ LOG_PRETTY: "" })).toBe(false);
  });
});
