/** @vitest-environment node */
import { describe, expect, it } from "vitest";

import { resolveRelationVerb } from "./relation-verbs";

describe("resolveRelationVerb", () => {
  it('maps ("supplies", "removed") to "stops supplying"', () => {
    expect(resolveRelationVerb("supplies", "removed")).toBe("stops supplying");
  });

  it("uses the static verb for neighborhood rows without a change", () => {
    expect(resolveRelationVerb("supplies")).toBe("supplies");
  });

  it("uses the past verb for added deltas", () => {
    expect(resolveRelationVerb("partners_with", "added")).toBe(
      "partnered with",
    );
  });

  it("returns the raw relation type as a fallback verb for unknown labels", () => {
    expect(resolveRelationVerb("custom_edge_type")).toBe("custom edge type");
  });
});
