/**
 * Unit tests for tickers list mapping.
 */

/** @vitest-environment node */
import type { Ticker } from "@mediapulse/database";
import { describe, expect, it } from "vitest";
import { mapRowToListItem } from "./list-mapper";

describe("mapRowToListItem", () => {
  it("stringifies the raw metadata blob and surfaces classification columns", () => {
    // Setup
    const createdAt = new Date("2024-06-01T12:00:00.000Z");
    const updatedAt = new Date("2024-06-02T12:00:00.000Z");
    const row = {
      id: "t-1",
      symbol: "ABC",
      name: "Alpha",
      sector: "Tech",
      industry: "Software",
      subSector: "Apps",
      subIndustry: "SaaS",
      businessActivity: "Cloud software",
      aliases: [],
      metadataRaw: { Sektor: "Tech" },
      createdAt,
      updatedAt,
    } satisfies Ticker;

    // Act
    const item = mapRowToListItem(row);

    // Assert
    expect(item).toEqual({
      id: "t-1",
      symbol: "ABC",
      name: "Alpha",
      sector: "Tech",
      industry: "Software",
      subSector: "Apps",
      subIndustry: "SaaS",
      businessActivity: "Cloud software",
      metadataRaw: JSON.stringify({ Sektor: "Tech" }, null, 2),
      createdAt: createdAt.toISOString(),
      updatedAt: updatedAt.toISOString(),
    });
  });

  it("uses empty strings when classification columns and metadataRaw are null", () => {
    // Setup
    const createdAt = new Date("2024-01-01T00:00:00.000Z");
    const updatedAt = new Date("2024-01-02T00:00:00.000Z");
    const row = {
      id: "t-2",
      symbol: "XYZ",
      name: "Zed",
      sector: null,
      industry: null,
      subSector: null,
      subIndustry: null,
      businessActivity: null,
      aliases: [],
      metadataRaw: null,
      createdAt,
      updatedAt,
    } satisfies Ticker;

    // Act
    const item = mapRowToListItem(row);

    // Assert
    expect(item.metadataRaw).toBe("");
    expect(item.sector).toBe("");
  });
});
