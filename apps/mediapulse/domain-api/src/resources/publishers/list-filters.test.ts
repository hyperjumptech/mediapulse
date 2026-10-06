import { describe, expect, it } from "vitest";

import {
  buildPublisherListOrderBy,
  buildPublisherListWhere,
  parsePublisherListSortField,
} from "./list-filters";

describe("buildPublisherListWhere", () => {
  it("returns an empty filter when nothing is set", () => {
    expect(buildPublisherListWhere({ q: "   " })).toEqual({});
  });

  it("searches the name and the domain case-insensitively", () => {
    const where = buildPublisherListWhere({ q: " batam " });

    expect(where).toEqual({
      OR: [
        { displayName: { contains: "batam", mode: "insensitive" } },
        { domain: { contains: "batam", mode: "insensitive" } },
      ],
    });
  });

  it("combines search with the name source filter", () => {
    const where = buildPublisherListWhere({
      q: "kontan",
      nameSource: "site_metadata",
    });

    expect(where).toEqual({
      AND: [
        {
          OR: [
            { displayName: { contains: "kontan", mode: "insensitive" } },
            { domain: { contains: "kontan", mode: "insensitive" } },
          ],
        },
        { nameSource: "site_metadata" },
      ],
    });
  });
});

describe("buildPublisherListOrderBy", () => {
  it("defaults to the most recently seen publisher first", () => {
    expect(buildPublisherListOrderBy(undefined, "asc")).toEqual([
      { lastSeenAt: "desc" },
      { domain: "asc" },
    ]);
  });

  it("breaks name ties on the domain so pages stay stable", () => {
    expect(buildPublisherListOrderBy("displayName", "asc")).toEqual([
      { displayName: "asc" },
      { domain: "asc" },
    ]);
  });

  it("sorts on the domain alone since it is unique", () => {
    expect(buildPublisherListOrderBy("domain", "desc")).toEqual([
      { domain: "desc" },
    ]);
  });
});

describe("parsePublisherListSortField", () => {
  it("accepts sortable fields and rejects the rest", () => {
    expect(parsePublisherListSortField("domain")).toBe("domain");
    expect(parsePublisherListSortField("nameSource")).toBeUndefined();
    expect(parsePublisherListSortField(undefined)).toBeUndefined();
  });
});
