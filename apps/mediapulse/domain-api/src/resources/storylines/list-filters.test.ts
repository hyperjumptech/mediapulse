/** @vitest-environment node */
import { describe, expect, it } from "vitest";

import {
  buildStorylineListOrderBy,
  buildStorylineListWhere,
  parseStorylineKind,
  parseStorylineLocked,
  parseStorylineSortBy,
} from "./list-filters";

describe("parseStorylineKind", () => {
  it("accepts the two known kinds and rejects anything else", () => {
    expect(parseStorylineKind("story")).toBe("story");
    expect(parseStorylineKind("format")).toBe("format");
    expect(parseStorylineKind("saga")).toBeUndefined();
    expect(parseStorylineKind(undefined)).toBeUndefined();
  });
});

describe("parseStorylineLocked", () => {
  it("parses only the literal boolean strings", () => {
    expect(parseStorylineLocked("true")).toBe(true);
    expect(parseStorylineLocked("false")).toBe(false);
    expect(parseStorylineLocked("1")).toBeUndefined();
    expect(parseStorylineLocked(undefined)).toBeUndefined();
  });
});

describe("parseStorylineSortBy", () => {
  it("accepts only the declared sortable fields", () => {
    expect(parseStorylineSortBy("name")).toBe("name");
    expect(parseStorylineSortBy("developmentCount")).toBe("developmentCount");
    expect(parseStorylineSortBy("lockedAt")).toBeUndefined();
  });
});

describe("buildStorylineListWhere", () => {
  it("returns an empty where when nothing is filtered", () => {
    expect(buildStorylineListWhere({})).toEqual({});
  });

  it("searches the name and the anchors case-insensitively", () => {
    expect(buildStorylineListWhere({ q: "  delay " })).toEqual({
      OR: [
        { name: { contains: "delay", mode: "insensitive" } },
        {
          anchors: {
            some: { anchor: { contains: "delay", mode: "insensitive" } },
          },
        },
      ],
    });
  });

  it("ignores a whitespace-only search", () => {
    expect(buildStorylineListWhere({ q: "   " })).toEqual({});
  });

  it("filters by kind and lock state", () => {
    expect(buildStorylineListWhere({ kind: "format", locked: false })).toEqual({
      AND: [{ kind: "format" }, { locked: false }],
    });
  });

  it("keeps a false lock filter rather than treating it as absent", () => {
    expect(buildStorylineListWhere({ locked: false })).toEqual({
      locked: false,
    });
  });

  it("filters by ticker through the join table", () => {
    expect(buildStorylineListWhere({ tickerId: "ticker-1" })).toEqual({
      tickers: { some: { tickerId: "ticker-1" } },
    });
  });

  it("bounds lastObservedAt from both ends", () => {
    const from = new Date("2026-03-01T00:00:00.000Z");
    const to = new Date("2026-03-31T23:59:59.999Z");

    expect(buildStorylineListWhere({ from, to })).toEqual({
      lastObservedAt: { gte: from, lte: to },
    });
  });

  it("drops an unparseable date bound", () => {
    expect(buildStorylineListWhere({ from: new Date("nope") })).toEqual({});
  });

  it("ands several filters together", () => {
    const where = buildStorylineListWhere({
      q: "delay",
      kind: "story",
      tickerId: "ticker-1",
    });

    expect(where.AND).toHaveLength(3);
  });
});

describe("buildStorylineListOrderBy", () => {
  it("defaults to the most recently observed storyline first", () => {
    expect(buildStorylineListOrderBy(undefined, undefined)).toEqual({
      lastObservedAt: "desc",
    });
  });

  it("orders by name and first observation", () => {
    expect(buildStorylineListOrderBy("name", "asc")).toEqual({ name: "asc" });
    expect(buildStorylineListOrderBy("firstObservedAt", "asc")).toEqual({
      firstObservedAt: "asc",
    });
  });

  it("orders by the development relation count", () => {
    expect(buildStorylineListOrderBy("developmentCount", "desc")).toEqual({
      developments: { _count: "desc" },
    });
  });
});
