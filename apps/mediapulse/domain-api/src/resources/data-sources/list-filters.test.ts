import { describe, expect, it } from "vitest";

import { buildDataSourceListWhere } from "./list-filters";

describe("buildDataSourceListWhere", () => {
  it("returns an empty filter when no inputs are set", () => {
    expect(buildDataSourceListWhere({})).toEqual({});
  });

  it("applies a case-insensitive multi-field substring search", () => {
    const where = buildDataSourceListWhere({ q: "  apple " });
    expect(where).toEqual({
      OR: [
        { title: { contains: "apple", mode: "insensitive" } },
        { url: { contains: "apple", mode: "insensitive" } },
        { content: { contains: "apple", mode: "insensitive" } },
        {
          ticker: {
            symbol: { contains: "apple", mode: "insensitive" },
          },
        },
        {
          ticker: { name: { contains: "apple", mode: "insensitive" } },
        },
        {
          searchQuery: {
            text: { contains: "apple", mode: "insensitive" },
          },
        },
      ],
    });
  });

  it("ignores whitespace-only search input", () => {
    expect(buildDataSourceListWhere({ q: "   " })).toEqual({});
  });

  it("filters by tickerId", () => {
    expect(
      buildDataSourceListWhere({
        tickerId: "11111111-1111-4111-a111-111111111111",
      }),
    ).toEqual({ tickerId: "11111111-1111-4111-a111-111111111111" });
  });

  it("filters by page-collection collectionSource", () => {
    expect(
      buildDataSourceListWhere({ collectionSource: "page-collection" }),
    ).toEqual({
      searchQueryId: null,
    });
  });

  it("filters by data-collection collectionSource", () => {
    expect(
      buildDataSourceListWhere({ collectionSource: "data-collection" }),
    ).toEqual({
      searchQueryId: { not: null },
    });
  });

  it("filters page-collection articles by collection gate status", () => {
    expect(
      buildDataSourceListWhere({ collectionGateStatus: "passed" }),
    ).toEqual({
      searchQueryId: null,
      collectionGateStatus: "passed",
    });
  });

  it("filters by a partial date range (from only)", () => {
    const from = new Date("2026-05-01T00:00:00.000Z");
    expect(buildDataSourceListWhere({ from })).toEqual({
      createdAt: { gte: from },
    });
  });

  it("filters by a partial date range (to only)", () => {
    const to = new Date("2026-05-31T23:59:59.999Z");
    expect(buildDataSourceListWhere({ to })).toEqual({
      createdAt: { lte: to },
    });
  });

  it("combines multiple filters under AND", () => {
    const from = new Date("2026-05-01T00:00:00.000Z");
    const where = buildDataSourceListWhere({
      q: "earnings",
      tickerId: "11111111-1111-4111-a111-111111111111",
      from,
    });
    expect(where).toEqual({
      AND: [
        {
          OR: [
            { title: { contains: "earnings", mode: "insensitive" } },
            { url: { contains: "earnings", mode: "insensitive" } },
            { content: { contains: "earnings", mode: "insensitive" } },
            {
              ticker: {
                symbol: { contains: "earnings", mode: "insensitive" },
              },
            },
            {
              ticker: { name: { contains: "earnings", mode: "insensitive" } },
            },
            {
              searchQuery: {
                text: { contains: "earnings", mode: "insensitive" },
              },
            },
          ],
        },
        { tickerId: "11111111-1111-4111-a111-111111111111" },
        { createdAt: { gte: from } },
      ],
    });
  });

  it("ignores invalid Date inputs", () => {
    expect(buildDataSourceListWhere({ from: new Date("not-a-date") })).toEqual(
      {},
    );
  });
});
