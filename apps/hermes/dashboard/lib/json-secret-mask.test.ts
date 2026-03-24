/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  isSensitiveJsonKey,
  maskSecretsInJson,
  SECRET_MASK,
} from "./json-secret-mask";

describe("json-secret-mask", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("isSensitiveJsonKey matches credential-like names", () => {
    // Assert
    expect(isSensitiveJsonKey("password")).toBe(true);
    expect(isSensitiveJsonKey("apiKey")).toBe(true);
    expect(isSensitiveJsonKey("session")).toBe(true);
    expect(isSensitiveJsonKey("bearer")).toBe(true);
    expect(isSensitiveJsonKey("title")).toBe(false);
  });

  it("maskSecretsInJson masks sensitive leaves and handles bigint and Date", () => {
    // Setup
    const input = {
      ok: 1n,
      when: new Date("2020-01-01T00:00:00.000Z"),
      nested: { token: "hide-me" },
    };

    // Act
    const out = maskSecretsInJson(input) as Record<string, unknown>;

    // Assert
    expect(out.ok).toBe("1");
    expect(out.when).toBe("2020-01-01T00:00:00.000Z");
    expect((out.nested as Record<string, unknown>).token).toBe(SECRET_MASK);
  });

  it("maskSecretsInJson returns SECRET_MASK for unsupported types", () => {
    // Act
    const out = maskSecretsInJson(() => {});

    // Assert
    expect(out).toBe(SECRET_MASK);
  });

  it("maskSecretsInJson passes null through under sensitive key", () => {
    // Act
    const out = maskSecretsInJson({ token: null }) as Record<string, unknown>;

    // Assert
    expect(out.token).toBeNull();
  });
});
