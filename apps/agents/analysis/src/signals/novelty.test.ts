/** @vitest-environment node */
import { describe, expect, it } from "vitest";
import { scoreNovelty } from "./novelty";

describe("scoreNovelty", () => {
  it("returns 1 when no selected titles exist", () => {
    // Setup
    const input = {
      title: "BBCA reports earnings growth in Q1",
      selectedTitles: [],
    };

    // Act
    const score = scoreNovelty(input);

    // Assert
    expect(score).toBe(1);
  });

  it("returns 0.2 for near-duplicate titles", () => {
    // Setup
    const input = {
      title: "BBCA reports strong Q1 earnings growth",
      selectedTitles: ["BBCA reports strong earnings growth in Q1"],
    };

    // Act
    const score = scoreNovelty(input);

    // Assert
    expect(score).toBe(0.2);
  });

  it("returns 1 for sufficiently different titles", () => {
    // Setup
    const input = {
      title: "Coal exports rise amid global demand",
      selectedTitles: ["BBCA reports strong earnings growth in Q1"],
    };

    // Act
    const score = scoreNovelty(input);

    // Assert
    expect(score).toBe(1);
  });
});
