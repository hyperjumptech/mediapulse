/** @vitest-environment node */
import { describe, expect, it } from "vitest";
import { scoreAliasMatch } from "./alias-match";

describe("scoreAliasMatch", () => {
  it("returns 1 when alias appears in title", () => {
    // Setup
    const input = {
      title: "BBCA posts strong quarterly earnings",
      content: "Some unrelated paragraph",
      aliases: ["BBCA", "Bank Central Asia"],
    };

    // Act
    const score = scoreAliasMatch(input);

    // Assert
    expect(score).toBe(1);
  });

  it("returns 0.7 when alias appears only in content", () => {
    // Setup
    const input = {
      title: "Indonesian banking outlook",
      content: "Bank Central Asia announced new lending products.",
      aliases: ["BBCA", "Bank Central Asia"],
    };

    // Act
    const score = scoreAliasMatch(input);

    // Assert
    expect(score).toBe(0.7);
  });

  it("returns 0 when no alias appears", () => {
    // Setup
    const input = {
      title: "Commodities update",
      content: "Coal prices moved higher this week.",
      aliases: ["BBCA"],
    };

    // Act
    const score = scoreAliasMatch(input);

    // Assert
    expect(score).toBe(0);
  });
});
