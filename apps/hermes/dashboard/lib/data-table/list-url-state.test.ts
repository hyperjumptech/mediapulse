import { describe, expect, it } from "vitest";

import {
  buildClearSearchHref,
  buildSortHref,
  type ListUrlState,
} from "./list-url-state";

const state: ListUrlState = {
  basePath: "/dashboard/variables",
  page: 3,
  pageSize: 25,
  total: 90,
  search: "api",
  sortBy: "key",
  sortDir: "asc",
  extra: { status: "active" },
};

describe("buildSortHref", () => {
  it("flips the direction of the active column and returns to page 1", () => {
    expect(buildSortHref(state, "key")).toBe(
      "/dashboard/variables?page=1&size=25&q=api&sort=key&dir=desc&status=active",
    );
  });

  it("sorts a new column ascending", () => {
    expect(buildSortHref(state, "created")).toBe(
      "/dashboard/variables?page=1&size=25&q=api&sort=created&dir=asc&status=active",
    );
  });

  it("sorts ascending when nothing is sorted yet", () => {
    expect(
      buildSortHref({ ...state, sortBy: undefined, sortDir: "desc" }, "key"),
    ).toBe(
      "/dashboard/variables?page=1&size=25&q=api&sort=key&dir=asc&status=active",
    );
  });
});

describe("buildClearSearchHref", () => {
  it("drops the search and page but keeps sort, size and filters", () => {
    expect(buildClearSearchHref(state)).toBe(
      "/dashboard/variables?page=1&size=25&sort=key&dir=asc&status=active",
    );
  });
});
