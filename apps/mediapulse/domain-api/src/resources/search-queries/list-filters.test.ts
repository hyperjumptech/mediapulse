import { describe, expect, it } from "vitest";

import { buildSearchQueryListWhere } from "./list-filters";

describe("buildSearchQueryListWhere", () => {
  it("returns an empty filter when no inputs are set", () => {
    expect(buildSearchQueryListWhere({})).toEqual({});
  });

  it("applies a case-insensitive search across text, ticker, and set fields", () => {
    const where = buildSearchQueryListWhere({ q: "  apple " });
    expect(where).toEqual({
      OR: [
        { text: { contains: "apple", mode: "insensitive" } },
        { ticker: { name: { contains: "apple", mode: "insensitive" } } },
        { ticker: { symbol: { contains: "apple", mode: "insensitive" } } },
        {
          set: {
            is: { id: { contains: "apple", mode: "insensitive" } },
          },
        },
        {
          set: {
            is: {
              agentJobId: { contains: "apple", mode: "insensitive" },
            },
          },
        },
      ],
    });
  });

  it("ignores whitespace-only search input", () => {
    expect(buildSearchQueryListWhere({ q: "   " })).toEqual({});
  });

  it("filters by tickerId", () => {
    expect(
      buildSearchQueryListWhere({
        tickerId: "11111111-1111-4111-a111-111111111111",
      }),
    ).toEqual({ tickerId: "11111111-1111-4111-a111-111111111111" });
  });

  it("filters by intent and source", () => {
    expect(
      buildSearchQueryListWhere({
        intent: "breaking",
        source: "llm",
      }),
    ).toEqual({
      AND: [{ intent: "breaking" }, { source: "llm" }],
    });
  });

  it("filters active-set yes via set.isActive true", () => {
    expect(buildSearchQueryListWhere({ isActive: true })).toEqual({
      set: { isActive: true },
    });
  });

  it("filters active-set no via null set or inactive set", () => {
    expect(buildSearchQueryListWhere({ isActive: false })).toEqual({
      OR: [{ set: null }, { set: { isActive: false } }],
    });
  });

  it("filters by a partial date range (from only)", () => {
    const from = new Date("2026-05-01T00:00:00.000Z");
    expect(buildSearchQueryListWhere({ from })).toEqual({
      createdAt: { gte: from },
    });
  });

  it("filters by a partial date range (to only)", () => {
    const to = new Date("2026-05-31T23:59:59.999Z");
    expect(buildSearchQueryListWhere({ to })).toEqual({
      createdAt: { lte: to },
    });
  });

  it("combines multiple filters under AND", () => {
    const where = buildSearchQueryListWhere({
      q: "nvidia",
      tickerId: "11111111-1111-4111-a111-111111111111",
      intent: "breaking",
      isActive: true,
    });
    expect(where).toEqual({
      AND: [
        {
          OR: [
            { text: { contains: "nvidia", mode: "insensitive" } },
            { ticker: { name: { contains: "nvidia", mode: "insensitive" } } },
            {
              ticker: { symbol: { contains: "nvidia", mode: "insensitive" } },
            },
            {
              set: {
                is: { id: { contains: "nvidia", mode: "insensitive" } },
              },
            },
            {
              set: {
                is: {
                  agentJobId: { contains: "nvidia", mode: "insensitive" },
                },
              },
            },
          ],
        },
        { tickerId: "11111111-1111-4111-a111-111111111111" },
        { intent: "breaking" },
        { set: { isActive: true } },
      ],
    });
  });

  it("ignores invalid Date inputs", () => {
    expect(buildSearchQueryListWhere({ from: new Date("not-a-date") })).toEqual(
      {},
    );
  });
});
