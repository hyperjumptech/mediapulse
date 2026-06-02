import { describe, expect, it } from "vitest";

import { buildEntityListWhere } from "./list-filters";

describe("buildEntityListWhere", () => {
  it("returns an empty filter when no inputs are set", () => {
    expect(buildEntityListWhere({})).toEqual({});
  });

  it("applies a case-insensitive search across name, description, and type", () => {
    const where = buildEntityListWhere({ q: "  apple " });
    expect(where).toEqual({
      OR: [
        { canonicalName: { contains: "apple", mode: "insensitive" } },
        { description: { contains: "apple", mode: "insensitive" } },
        { type: { name: { contains: "apple", mode: "insensitive" } } },
      ],
    });
  });

  it("ignores whitespace-only search input", () => {
    expect(buildEntityListWhere({ q: "   " })).toEqual({});
  });

  it("filters by tickerId via tickerEntities", () => {
    expect(
      buildEntityListWhere({
        tickerId: "11111111-1111-4111-a111-111111111111",
      }),
    ).toEqual({
      tickerEntities: {
        some: { tickerId: "11111111-1111-4111-a111-111111111111" },
      },
    });
  });

  it("filters by typeId", () => {
    expect(
      buildEntityListWhere({
        typeId: "22222222-2222-4222-a222-222222222222",
      }),
    ).toEqual({ typeId: "22222222-2222-4222-a222-222222222222" });
  });

  it("filters by a partial date range (from only)", () => {
    const from = new Date("2026-05-01T00:00:00.000Z");
    expect(buildEntityListWhere({ from })).toEqual({
      createdAt: { gte: from },
    });
  });

  it("filters by a partial date range (to only)", () => {
    const to = new Date("2026-05-31T23:59:59.999Z");
    expect(buildEntityListWhere({ to })).toEqual({
      createdAt: { lte: to },
    });
  });

  it("combines multiple filters under AND", () => {
    const where = buildEntityListWhere({
      q: "nvidia",
      tickerId: "11111111-1111-4111-a111-111111111111",
      typeId: "22222222-2222-4222-a222-222222222222",
    });
    expect(where).toEqual({
      AND: [
        {
          OR: [
            { canonicalName: { contains: "nvidia", mode: "insensitive" } },
            { description: { contains: "nvidia", mode: "insensitive" } },
            { type: { name: { contains: "nvidia", mode: "insensitive" } } },
          ],
        },
        {
          tickerEntities: {
            some: { tickerId: "11111111-1111-4111-a111-111111111111" },
          },
        },
        { typeId: "22222222-2222-4222-a222-222222222222" },
      ],
    });
  });

  it("ignores invalid Date inputs", () => {
    expect(buildEntityListWhere({ from: new Date("not-a-date") })).toEqual({});
  });
});
