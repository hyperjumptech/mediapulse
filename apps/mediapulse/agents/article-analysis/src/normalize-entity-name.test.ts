/** @vitest-environment node */
import { describe, expect, it } from "vitest";

import { normalizeEntityName } from "./normalize-entity-name.js";

describe("normalizeEntityName", () => {
  it("trims and lowercases", () => {
    // Act
    const out = normalizeEntityName("  Acme Corp  ");
    // Assert
    expect(out).toBe("acme corp");
  });
});
