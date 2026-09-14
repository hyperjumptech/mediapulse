import { describe, expect, it } from "vitest";

import { splicesClauses } from "./clause-splice.js";

describe("splicesClauses", () => {
  it("flags the stranded clause shipped on 2026-09-13", () => {
    // Assert
    expect(
      splicesClauses(
        "RAIA Grid has 86,000 km of fiber network; its operator, IFT.",
      ),
    ).toBe(true);
  });

  it("flags two facts glued into one point", () => {
    // Assert
    expect(
      splicesClauses(
        "DSSA posted US$211.8 million in 2025; US$69.1 million in Q1 2026.",
      ),
    ).toBe(true);
  });

  it("passes a point carrying one fact", () => {
    // Assert
    expect(
      splicesClauses(
        "DSSA's digital infrastructure business posted US$211.8 million of revenue in 2025.",
      ),
    ).toBe(false);
    expect(
      splicesClauses(
        "The merger creates a bank holding Rp40 trillion of assets, spread across 120 branches.",
      ),
    ).toBe(false);
  });
});
