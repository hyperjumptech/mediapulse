/** @vitest-environment node */
import { describe, expect, it } from "vitest";

import { normalizeQueryTextKey } from "./normalize-query-text.js";

describe("normalizeQueryTextKey", () => {
  it("trims and lowercases with collapsed whitespace", () => {
    expect(normalizeQueryTextKey("  Foo   BAR  ")).toBe("foo bar");
  });
});
