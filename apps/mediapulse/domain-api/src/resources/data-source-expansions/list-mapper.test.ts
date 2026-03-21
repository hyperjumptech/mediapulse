/** @vitest-environment node */
import type { DataSourceExpansion } from "@mediapulse/database";
import { describe, expect, it } from "vitest";
import { mapRowToListItem } from "./list-mapper";

describe("mapRowToListItem", () => {
  it("maps expansion fields and dates", () => {
    // Setup
    const createdAt = new Date("2024-08-01T00:00:00.000Z");
    const updatedAt = new Date("2024-08-02T00:00:00.000Z");
    const row = {
      id: "dse-1",
      name: "alias-a",
      expansionString: "db:foo",
      description: "note",
      createdAt,
      updatedAt,
      createdById: "admin-1",
    } satisfies DataSourceExpansion;

    // Act
    const item = mapRowToListItem(row);

    // Assert
    expect(item).toEqual({
      id: "dse-1",
      name: "alias-a",
      expansionString: "db:foo",
      description: "note",
      createdAt: createdAt.toISOString(),
      updatedAt: updatedAt.toISOString(),
    });
  });
});
