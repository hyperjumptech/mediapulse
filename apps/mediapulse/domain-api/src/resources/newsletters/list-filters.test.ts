import { describe, expect, it } from "vitest";

import {
  buildNewsletterListOrderBy,
  buildNewsletterListWhere,
} from "./list-filters";

describe("buildNewsletterListWhere", () => {
  it("returns an empty filter when no inputs are set", () => {
    expect(buildNewsletterListWhere({})).toEqual({});
  });

  it("applies a case-insensitive subject substring search", () => {
    const where = buildNewsletterListWhere({ q: "  apple " });
    expect(where).toEqual({
      subject: { contains: "apple", mode: "insensitive" },
    });
  });

  it("ignores whitespace-only search input", () => {
    expect(buildNewsletterListWhere({ q: "   " })).toEqual({});
  });

  it("filters by tickerId", () => {
    expect(
      buildNewsletterListWhere({
        tickerId: "11111111-1111-4111-a111-111111111111",
      }),
    ).toEqual({ tickerId: "11111111-1111-4111-a111-111111111111" });
  });

  it("filters by a partial date range (from only)", () => {
    const from = new Date("2026-05-01T00:00:00.000Z");
    expect(buildNewsletterListWhere({ from })).toEqual({
      createdAt: { gte: from },
    });
  });

  it("filters by a partial date range (to only)", () => {
    const to = new Date("2026-05-31T23:59:59.999Z");
    expect(buildNewsletterListWhere({ to })).toEqual({
      createdAt: { lte: to },
    });
  });

  it("combines multiple filters under AND", () => {
    const where = buildNewsletterListWhere({
      q: "earnings",
      tickerId: "11111111-1111-4111-a111-111111111111",
    });
    expect(where).toEqual({
      AND: [
        { subject: { contains: "earnings", mode: "insensitive" } },
        { tickerId: "11111111-1111-4111-a111-111111111111" },
      ],
    });
  });

  it("ignores invalid Date inputs", () => {
    expect(buildNewsletterListWhere({ from: new Date("not-a-date") })).toEqual(
      {},
    );
  });
});

describe("buildNewsletterListOrderBy", () => {
  it("defaults to createdAt DESC", () => {
    expect(buildNewsletterListOrderBy(undefined, undefined)).toEqual({
      createdAt: "desc",
    });
  });

  it("sorts by subject when requested", () => {
    expect(buildNewsletterListOrderBy("subject", "asc")).toEqual({
      subject: "asc",
    });
  });

  it("honors asc on createdAt", () => {
    expect(buildNewsletterListOrderBy("createdAt", "asc")).toEqual({
      createdAt: "asc",
    });
  });
});
