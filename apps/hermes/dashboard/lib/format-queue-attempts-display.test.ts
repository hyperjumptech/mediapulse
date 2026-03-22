import { describe, expect, it } from "vitest";
import { formatQueueAttemptsDisplay } from "./format-queue-attempts-display";

describe("formatQueueAttemptsDisplay", () => {
  it("returns em dash when both are missing", () => {
    expect(formatQueueAttemptsDisplay(null, null)).toBe("—");
    expect(formatQueueAttemptsDisplay(undefined, undefined)).toBe("—");
  });

  it("returns fraction when both are present", () => {
    expect(formatQueueAttemptsDisplay(2, 5)).toBe("2 / 5");
  });

  it("returns attempts only when max is missing", () => {
    expect(formatQueueAttemptsDisplay(3, null)).toBe("3");
  });

  it("returns placeholder max when attempts missing", () => {
    expect(formatQueueAttemptsDisplay(null, 5)).toBe("— / 5");
  });
});
