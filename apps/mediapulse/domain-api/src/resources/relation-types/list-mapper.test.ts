/**
 * Unit tests for relation-types list mapping.
 */

/** @vitest-environment node */
import type { RelationType } from "@mediapulse/database";
import { describe, expect, it } from "vitest";
import { mapRowToListItem } from "./list-mapper";

describe("mapRowToListItem", () => {
  it("maps name and description", () => {
    // Setup
    const createdAt = new Date("2024-05-01T00:00:00.000Z");
    const updatedAt = new Date("2024-05-02T00:00:00.000Z");
    const row = {
      id: "r-1",
      name: "OWNS",
      description: "ownership",
      createdAt,
      updatedAt,
    } satisfies RelationType;

    // Act
    const item = mapRowToListItem(row);

    // Assert
    expect(item).toEqual({
      id: "r-1",
      name: "OWNS",
      description: "ownership",
      createdAt: createdAt.toISOString(),
      updatedAt: updatedAt.toISOString(),
    });
  });
});
