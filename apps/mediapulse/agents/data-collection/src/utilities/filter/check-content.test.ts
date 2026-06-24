/** @vitest-environment node */

import { describe, expect, it } from "vitest";

import { checkContent } from "./check-content";

const longArticle = (
  "Apple reported quarterly earnings that beat analyst expectations. " +
  "The company cited strong iPhone demand and services growth across regions. "
).repeat(8);

describe("checkContent", () => {
  it("keeps a substantial article", () => {
    const decision = checkContent(
      "Apple beats earnings expectations",
      longArticle,
      "https://example.com/apple",
    );

    expect(decision.blocked).toBe(false);
  });

  it("drops empty content", () => {
    const decision = checkContent("Some title", "", "https://example.com/x");

    expect(decision.blocked).toBe(true);
  });
});
