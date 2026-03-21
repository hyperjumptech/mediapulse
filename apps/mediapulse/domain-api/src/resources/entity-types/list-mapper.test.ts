/** @vitest-environment node */
import type { EntityType } from "@mediapulse/database";
import { describe, expect, it } from "vitest";
import { mapRowToListItem } from "./list-mapper";

describe("mapRowToListItem", () => {
  it("passes through nullable description", () => {
    // Setup
    const createdAt = new Date("2024-04-01T00:00:00.000Z");
    const updatedAt = new Date("2024-04-02T00:00:00.000Z");
    const row = {
      id: "e-1",
      name: "ORG",
      description: null,
      createdAt,
      updatedAt,
    } satisfies EntityType;

    // Act
    const item = mapRowToListItem(row);

    // Assert
    expect(item.description).toBeNull();
    expect(item.name).toBe("ORG");
  });
});
