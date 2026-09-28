import { describe, expect, it } from "vitest";

import {
  buildListHref,
  DEFAULT_LIST_PAGE_SIZE,
  nextSortDirection,
  parseListPagination,
  parseListSearch,
  parseListSort,
} from "./list-page-params";

describe("parseListPagination", () => {
  it("defaults to the first page and the default size", () => {
    expect(parseListPagination({})).toEqual({
      page: 1,
      pageSize: DEFAULT_LIST_PAGE_SIZE,
    });
  });

  it("parses page and size", () => {
    expect(parseListPagination({ page: "3", size: "25" })).toEqual({
      page: 3,
      pageSize: 25,
    });
  });

  it.each([
    [{ page: "0" }, 1],
    [{ page: "-4" }, 1],
    [{ page: "abc" }, 1],
  ])("clamps an invalid page %j to %i", (searchParams, expectedPage) => {
    expect(parseListPagination(searchParams).page).toBe(expectedPage);
  });

  it("caps the page size at 100 and floors it at 1", () => {
    expect(parseListPagination({ size: "500" }).pageSize).toBe(100);
    expect(parseListPagination({ size: "-3" }).pageSize).toBe(1);
  });

  it("falls back to a custom default size", () => {
    expect(parseListPagination({ size: "nope" }, 50).pageSize).toBe(50);
  });
});

describe("parseListSort", () => {
  const fields = ["name", "created"] as const;

  it("accepts known fields and directions", () => {
    expect(
      parseListSort({ sort: "created", dir: "desc" }, fields, "name"),
    ).toEqual({ sortBy: "created", sortDir: "desc" });
  });

  it("falls back for unknown fields and directions", () => {
    expect(
      parseListSort({ sort: "password", dir: "sideways" }, fields, "name"),
    ).toEqual({ sortBy: "name", sortDir: "asc" });
  });

  it("uses the provided default direction", () => {
    expect(parseListSort({}, fields, "created", "desc")).toEqual({
      sortBy: "created",
      sortDir: "desc",
    });
  });
});

describe("parseListSearch", () => {
  it("trims the query", () => {
    expect(parseListSearch({ q: "  daily  " })).toBe("daily");
  });

  it.each([{}, { q: "" }, { q: "   " }])(
    "returns undefined for an empty query %j",
    (searchParams) => {
      expect(parseListSearch(searchParams)).toBeUndefined();
    },
  );
});

describe("buildListHref", () => {
  it("builds a list URL and skips empty values", () => {
    expect(
      buildListHref("/dashboard/schedules", {
        page: 2,
        pageSize: 15,
        search: "daily",
        sortBy: "name",
        sortDir: "desc",
        extra: { from: "2026-09-01", to: undefined, status: "" },
      }),
    ).toBe(
      "/dashboard/schedules?page=2&size=15&q=daily&sort=name&dir=desc&from=2026-09-01",
    );
  });

  it("defaults to the first page", () => {
    expect(buildListHref("/dashboard/agents", {})).toBe(
      "/dashboard/agents?page=1",
    );
  });
});

describe("nextSortDirection", () => {
  it("flips the active ascending column to descending", () => {
    expect(nextSortDirection("name", "name", "asc")).toBe("desc");
  });

  it("starts other columns ascending", () => {
    expect(nextSortDirection("created", "name", "desc")).toBe("asc");
  });
});
