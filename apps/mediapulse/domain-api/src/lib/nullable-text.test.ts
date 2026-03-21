import { describe, expect, it } from "vitest";
import { nullableText } from "./nullable-text";

describe("nullableText", () => {
  it("returns null for null, undefined, empty, or whitespace-only input", () => {
    // Act
    const a = nullableText(null);
    const b = nullableText(undefined);
    const c = nullableText("");
    const d = nullableText("   \t\n");

    // Assert
    expect(a).toBeNull();
    expect(b).toBeNull();
    expect(c).toBeNull();
    expect(d).toBeNull();
  });

  it("returns trimmed text when content remains after trim", () => {
    // Act
    const result = nullableText("  hello  ");

    // Assert
    expect(result).toBe("hello");
  });
});
