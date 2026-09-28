import type { CuratedSource } from "@mediapulse/database";
import { describe, expect, it } from "vitest";

import { mapRowToListItem } from "./list-mapper";

const buildRow = (overrides: Partial<CuratedSource>): CuratedSource => ({
  id: "source-1",
  name: "Kontan",
  listingUrl: "https://example.com/rss",
  linkType: "listing",
  enabled: true,
  maxItems: 25,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-02T00:00:00.000Z"),
  ...overrides,
});

describe("curated-sources > mapRowToListItem", () => {
  it("keeps the item cap as a number", () => {
    const item = mapRowToListItem(buildRow({ maxItems: 25 }));

    expect(item.maxItems).toBe(25);
  });

  it("leaves the item cap empty when the source has none", () => {
    const item = mapRowToListItem(buildRow({ maxItems: null }));

    expect(item.maxItems).toBeNull();
  });

  it("keeps the raw link type and enabled flag so the edit form reads them back", () => {
    const item = mapRowToListItem(
      buildRow({ linkType: "page", enabled: false }),
    );

    expect(item.linkType).toBe("page");
    expect(item.enabled).toBe(false);
  });
});
