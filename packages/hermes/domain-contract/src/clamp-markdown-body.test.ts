/** @vitest-environment node */
import { describe, expect, it } from "vitest";

import { clampMarkdownBody } from "./clamp-markdown-body";

describe("clampMarkdownBody", () => {
  it("returns the body unchanged when shorter than threshold", () => {
    const result = clampMarkdownBody("short body", { clampChars: 100 });
    expect(result.clamped).toBe(false);
    expect(result.visible).toBe("short body");
  });

  it("clamps when length exceeds threshold (default 2x clampChars)", () => {
    const body = "a".repeat(2500);
    const result = clampMarkdownBody(body, { clampChars: 1000 });
    expect(result.clamped).toBe(true);
    expect(result.visible).toHaveLength(1000);
    expect(result.originalLength).toBe(2500);
  });

  it("does not clamp when length is just under the explicit threshold", () => {
    const body = "a".repeat(9999);
    const result = clampMarkdownBody(body, {
      clampChars: 4000,
      clampThreshold: 10000,
    });
    expect(result.clamped).toBe(false);
  });

  it("clamps when length exceeds the explicit threshold", () => {
    const body = "a".repeat(10001);
    const result = clampMarkdownBody(body, {
      clampChars: 4000,
      clampThreshold: 10000,
    });
    expect(result.clamped).toBe(true);
    expect(result.visible).toHaveLength(4000);
  });

  it("returns the body unchanged when clampChars is zero or negative", () => {
    const result = clampMarkdownBody("anything", { clampChars: 0 });
    expect(result.clamped).toBe(false);
    expect(result.visible).toBe("anything");
  });
});
