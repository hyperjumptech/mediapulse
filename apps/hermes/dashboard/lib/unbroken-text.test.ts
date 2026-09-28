import { describe, expect, it } from "vitest";

import { isUnbrokenText } from "./unbroken-text";

describe("isUnbrokenText", () => {
  it.each([
    "https://example.com/a/very/long/path?query=1",
    "3f1c9a52-7d0e-4b8a-9f3e-2c6d1b0a8e47",
    "someone@example.com",
  ])("treats %s as one unbroken token", (text) => {
    expect(isUnbrokenText(text)).toBe(true);
  });

  it.each(["Apple Inc.", "Line one\nLine two", "tab\tseparated", ""])(
    "does not treat %j as one unbroken token",
    (text) => {
      expect(isUnbrokenText(text)).toBe(false);
    },
  );
});
