/** @vitest-environment node */
import { describe, expect, it } from "vitest";
import { scoreEntityOverlap } from "./entity-overlap";

describe("scoreEntityOverlap", () => {
  it("returns overlap ratio for matched entities", () => {
    // Setup
    const input = {
      articleEntities: ["OJK", "Bank Central Asia", "IDX"],
      existingEntityNames: ["Bank Central Asia", "BEI"],
    };

    // Act
    const score = scoreEntityOverlap(input);

    // Assert
    expect(score).toBe(1 / 3);
  });

  it("returns 0 when no article entities exist", () => {
    // Setup
    const input = {
      articleEntities: [],
      existingEntityNames: ["Bank Central Asia"],
    };

    // Act
    const score = scoreEntityOverlap(input);

    // Assert
    expect(score).toBe(0);
  });
});
