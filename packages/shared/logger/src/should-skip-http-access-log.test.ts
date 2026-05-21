import type { Context } from "hono";
import { describe, expect, it } from "vitest";

import {
  normalizeHttpAccessLogPath,
  shouldSkipHttpAccessLog,
} from "./should-skip-http-access-log";

describe("normalizeHttpAccessLogPath", () => {
  it("returns root unchanged", () => {
    // Act
    const path = normalizeHttpAccessLogPath("/");

    // Assert
    expect(path).toBe("/");
  });

  it("strips a trailing slash from non-root paths", () => {
    // Act
    const path = normalizeHttpAccessLogPath("/health/");

    // Assert
    expect(path).toBe("/health");
  });

  it("leaves paths without a trailing slash unchanged", () => {
    // Act
    const path = normalizeHttpAccessLogPath("/health");

    // Assert
    expect(path).toBe("/health");
  });
});

describe("shouldSkipHttpAccessLog", () => {
  const fakeContext = (method: string, path: string): Context =>
    ({
      req: { method, path },
    }) as unknown as Context;

  it("returns true for GET /health", () => {
    // Act
    const skip = shouldSkipHttpAccessLog(fakeContext("GET", "/health"));

    // Assert
    expect(skip).toBe(true);
  });

  it("returns true for GET /health/", () => {
    // Act
    const skip = shouldSkipHttpAccessLog(fakeContext("GET", "/health/"));

    // Assert
    expect(skip).toBe(true);
  });

  it("returns false for POST /health", () => {
    // Act
    const skip = shouldSkipHttpAccessLog(fakeContext("POST", "/health"));

    // Assert
    expect(skip).toBe(false);
  });

  it("returns false for GET on other paths", () => {
    // Act
    const skip = shouldSkipHttpAccessLog(fakeContext("GET", "/api/token"));

    // Assert
    expect(skip).toBe(false);
  });
});
