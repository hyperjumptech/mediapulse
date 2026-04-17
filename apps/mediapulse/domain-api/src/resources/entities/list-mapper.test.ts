/**
 * Unit tests for entities list/detail mapping.
 */

/** @vitest-environment node */
import { describe, expect, it } from "vitest";
import type { ListRow } from "./list-mapper";
import {
  ENTITY_DESCRIPTION_PREVIEW_MAX,
  mapRowToDetailItem,
  mapRowToListItem,
  truncateDescriptionPreview,
} from "./list-mapper";

describe("truncateDescriptionPreview", () => {
  it("returns null for null input", () => {
    expect(truncateDescriptionPreview(null, 10)).toBeNull();
  });

  it("truncates long descriptions with ellipsis", () => {
    const long = "x".repeat(ENTITY_DESCRIPTION_PREVIEW_MAX + 10);
    const out = truncateDescriptionPreview(
      long,
      ENTITY_DESCRIPTION_PREVIEW_MAX,
    );
    expect(out).toHaveLength(ENTITY_DESCRIPTION_PREVIEW_MAX + 1);
    expect(out?.endsWith("…")).toBe(true);
  });
});

describe("mapRowToListItem", () => {
  it("maps type name and ISO timestamps", () => {
    const createdAt = new Date("2024-04-01T12:00:00.000Z");
    const updatedAt = new Date("2024-04-02T12:00:00.000Z");
    const row = {
      id: "ent-1",
      typeId: "type-1",
      canonicalName: "Example Co",
      description: "Short",
      metadata: null,
      createdAt,
      updatedAt,
      type: { name: "ORG" },
    } as ListRow;

    const item = mapRowToListItem(row);

    expect(item.canonicalName).toBe("Example Co");
    expect(item.entityTypeName).toBe("ORG");
    expect(item.descriptionPreview).toBe("Short");
    expect(item.createdAt).toBe("2024-04-01T12:00:00.000Z");
  });
});

describe("mapRowToDetailItem", () => {
  it("includes metadata and type id", () => {
    const createdAt = new Date("2024-04-01T00:00:00.000Z");
    const updatedAt = new Date("2024-04-02T00:00:00.000Z");
    const row = {
      id: "ent-2",
      typeId: "type-9",
      canonicalName: "Other",
      description: null,
      metadata: { tier: 1 },
      createdAt,
      updatedAt,
      type: { name: "PERSON" },
    } as ListRow;

    const detail = mapRowToDetailItem(row);

    expect(detail.typeId).toBe("type-9");
    expect(detail.metadata).toEqual({ tier: 1 });
    expect(detail.entityTypeName).toBe("PERSON");
    expect(detail.description).toBeNull();
  });
});
