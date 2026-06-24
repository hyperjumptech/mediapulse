/** @vitest-environment node */

import { describe, expect, it } from "vitest";

import { checkDuplicate } from "./check-duplicate";

describe("checkDuplicate", () => {
  it("drops a URL already in the seen set", () => {
    const seen = new Set(["https://example.com/a"]);

    expect(checkDuplicate("https://example.com/a", seen)).toEqual({
      keep: false,
      reason: "duplicate",
    });
  });

  it("keeps a URL not seen yet", () => {
    const seen = new Set(["https://example.com/a"]);

    expect(checkDuplicate("https://example.com/b", seen)).toEqual({
      keep: true,
    });
  });
});
