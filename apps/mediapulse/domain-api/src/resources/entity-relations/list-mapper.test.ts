/**
 * Unit tests for entity-relations list/detail mapping.
 */

/** @vitest-environment node */
import { describe, expect, it } from "vitest";
import type { ListRow } from "./list-mapper";
import { mapRowToListItem } from "./list-mapper";

describe("mapRowToListItem", () => {
  it("maps joined names and timestamps", () => {
    const lastSeenAt = new Date("2024-08-01T00:00:00.000Z");
    const createdAt = new Date("2024-07-01T00:00:00.000Z");
    const row = {
      id: "rel-1",
      fromEntityId: "e-a",
      toEntityId: "e-b",
      relationTypeId: "rt-1",
      weight: 0.75,
      lastSeenAt,
      createdAt,
      fromEntity: { id: "e-a", canonicalName: "Parent Inc" },
      toEntity: { id: "e-b", canonicalName: "Child LLC" },
      relationType: { name: "SUBSIDIARY_OF" },
    } as ListRow;

    const item = mapRowToListItem(row);

    expect(item.fromEntityName).toBe("Parent Inc");
    expect(item.toEntityName).toBe("Child LLC");
    expect(item.relationTypeName).toBe("SUBSIDIARY_OF");
    expect(item.weight).toBe(0.75);
    expect(item.lastSeenAt).toBe("2024-08-01T00:00:00.000Z");
    expect(item.createdAt).toBe("2024-07-01T00:00:00.000Z");
  });
});
