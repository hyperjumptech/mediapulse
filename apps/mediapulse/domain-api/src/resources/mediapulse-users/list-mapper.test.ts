/**
 * Unit tests for mediapulse-users list mapping.
 */

/** @vitest-environment node */
import type { MediapulseUserListRow } from "./list-mapper";
import { describe, expect, it } from "vitest";
import {
  formatLanguageLabel,
  formatUserLanguages,
  mapRowToListItem,
} from "./list-mapper";

describe("formatLanguageLabel", () => {
  it("maps English and Indonesian codes", () => {
    expect(formatLanguageLabel("en")).toBe("English");
    expect(formatLanguageLabel("id")).toBe("Indonesian");
  });
});

describe("formatUserLanguages", () => {
  it("returns a single language label", () => {
    expect(formatUserLanguages([{ language: "en" }])).toBe("English");
  });

  it("deduplicates and sorts multiple languages", () => {
    expect(
      formatUserLanguages([
        { language: "id" },
        { language: "en" },
        { language: "en" },
      ]),
    ).toBe("English, Indonesian");
  });

  it("returns an em dash when there are no subscriptions", () => {
    expect(formatUserLanguages([])).toBe("—");
  });
});

describe("mapRowToListItem", () => {
  it("maps scalar fields, languages, and ISO dates", () => {
    const createdAt = new Date("2024-03-01T08:00:00.000Z");
    const updatedAt = new Date("2024-03-02T08:00:00.000Z");
    const row = {
      id: "u-1",
      email: "a@example.com",
      name: "Ada",
      enabled: true,
      createdAt,
      updatedAt,
      userTickers: [{ language: "en" as const }, { language: "id" as const }],
    } satisfies MediapulseUserListRow;

    const item = mapRowToListItem(row);

    expect(item).toEqual({
      id: "u-1",
      email: "a@example.com",
      name: "Ada",
      enabled: true,
      languages: "English, Indonesian",
      createdAt: createdAt.toISOString(),
      updatedAt: updatedAt.toISOString(),
    });
  });

  it("maps disabled users to false and empty subscriptions to an em dash", () => {
    const row = {
      id: "u-2",
      email: "b@example.com",
      name: null,
      enabled: false,
      createdAt: new Date("2024-03-01T08:00:00.000Z"),
      updatedAt: new Date("2024-03-02T08:00:00.000Z"),
      userTickers: [],
    } satisfies MediapulseUserListRow;

    expect(mapRowToListItem(row).enabled).toBe(false);
    expect(mapRowToListItem(row).languages).toBe("—");
  });
});
