import { describe, expect, it } from "vitest";

import { lonePointRestatesTitle } from "./lone-point-restates-title.js";

describe("lonePointRestatesTitle", () => {
  it("flags a lone point drawn entirely from the heading", () => {
    // Setup
    const title =
      "Government Targets Additional 42.6 GW of Renewable Energy Until 2034";
    const points = [
      "The government targets an addition of 42.6 GW capacity in new and renewable energy projects by 2034.",
    ];

    // Assert
    expect(lonePointRestatesTitle(points, title)).toBe(true);
  });

  it("passes a lone point carrying a fact the heading omits", () => {
    // Setup
    const title =
      "Government Targets Additional 42.6 GW of Renewable Energy Until 2034";
    const points = [
      "The 42.6 GW is 62% of the roughly 70 GW total addition planned under RUPTL 2025-2034.",
    ];

    // Assert
    expect(lonePointRestatesTitle(points, title)).toBe(false);
  });

  it("passes an item carrying more than one point", () => {
    // Setup
    const title = "Coal Prices Reach Highest Level in 11 Weeks";
    const points = [
      "Coal prices reached their highest level in 11 weeks.",
      "Newcastle coal settled at US$148.65 per ton on 4 September.",
    ];

    // Assert
    expect(lonePointRestatesTitle(points, title)).toBe(false);
  });

  it("passes when the heading carries no distinctive tokens", () => {
    // Assert
    expect(
      lonePointRestatesTitle(["BRI opened a Taiwan branch."], "Update"),
    ).toBe(false);
  });

  it("passes when there are no points at all", () => {
    // Assert
    expect(lonePointRestatesTitle([], "Anything at all")).toBe(false);
  });
});
