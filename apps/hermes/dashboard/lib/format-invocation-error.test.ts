/** @vitest-environment node */
import { describe, expect, it } from "vitest";

import { formatInvocationErrorSummary } from "./format-invocation-error";

describe("formatInvocationErrorSummary", () => {
  it("returns null for null or undefined", () => {
    expect(formatInvocationErrorSummary(null)).toBeNull();
    expect(formatInvocationErrorSummary(undefined)).toBeNull();
  });

  it("returns message when error object has non-empty message string", () => {
    expect(
      formatInvocationErrorSummary({
        message: "Agent HTTP 404",
        retryable: false,
      }),
    ).toBe("Agent HTTP 404");
  });

  it("stringifies object without message", () => {
    expect(formatInvocationErrorSummary({ code: "E_BAD" })).toBe(
      '{"code":"E_BAD"}',
    );
  });

  it("truncates long JSON stringification", () => {
    const big = { x: "y".repeat(1000) };
    const result = formatInvocationErrorSummary(big);
    expect(result).toContain("…");
    expect(result!.length).toBeLessThanOrEqual(803);
  });

  it("falls back to String for non-serializable values", () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    const result = formatInvocationErrorSummary(circular);
    expect(result).toContain("[object Object]");
  });
});
