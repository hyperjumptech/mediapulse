/** @vitest-environment node */
import { describe, expect, it } from "vitest";

import {
  DEFAULT_API_PAGE_SIZE,
  MAX_API_PAGE_SIZE,
  parseApiListParams,
  parseApiListQuery,
  parseApiPageParams,
} from "./parse-api-page-params";

const sortOptions = {
  fields: ["name", "created"] as const,
  defaultField: "name" as const,
};

describe("parseApiPageParams", () => {
  it("returns defaults when query params are missing", () => {
    const result = parseApiPageParams(
      new Request("http://localhost/api/agents"),
    );

    expect(result).toEqual({ page: 1, pageSize: DEFAULT_API_PAGE_SIZE });
  });

  it("parses page and pageSize from the URL", () => {
    const result = parseApiPageParams(
      new Request("http://localhost/api/agents?page=2&pageSize=50"),
    );

    expect(result).toEqual({ page: 2, pageSize: 50 });
  });

  it("clamps invalid values to safe bounds", () => {
    const result = parseApiPageParams(
      new Request("http://localhost/api/agents?page=0&pageSize=500"),
    );

    expect(result).toEqual({ page: 1, pageSize: MAX_API_PAGE_SIZE });
  });

  it("honors custom defaults", () => {
    const result = parseApiPageParams(
      new Request("http://localhost/api/agents"),
      { page: 3, pageSize: 10 },
    );

    expect(result).toEqual({ page: 3, pageSize: 10 });
  });
});

describe("parseApiListQuery", () => {
  it("reads q, sort, and dir alongside pagination", () => {
    const result = parseApiListQuery(
      new Request(
        "http://localhost/api/agents?page=3&pageSize=5&q=%20summar%20&sort=created&dir=desc",
      ),
    );

    expect(result).toEqual({
      page: 3,
      pageSize: 5,
      search: "summar",
      sort: "created",
      dir: "desc",
    });
  });

  it("drops blank search, blank sort, and unknown directions", () => {
    const result = parseApiListQuery(
      new Request("http://localhost/api/agents?q=%20%20&sort=&dir=sideways"),
    );

    expect(result).toEqual({
      page: 1,
      pageSize: DEFAULT_API_PAGE_SIZE,
      search: undefined,
      sort: undefined,
      dir: undefined,
    });
  });
});

describe("parseApiListParams", () => {
  it("accepts a known sort field and direction", () => {
    const result = parseApiListParams(
      new Request("http://localhost/api/x?q=abc&sort=created&dir=desc"),
      sortOptions,
    );

    expect(result).toEqual({
      page: 1,
      pageSize: DEFAULT_API_PAGE_SIZE,
      search: "abc",
      sortBy: "created",
      sortDir: "desc",
    });
  });

  it("falls back to the default sort for unknown fields", () => {
    const result = parseApiListParams(
      new Request("http://localhost/api/x?sort=password"),
      { ...sortOptions, defaultDirection: "desc" },
    );

    expect(result.sortBy).toBe("name");
    expect(result.sortDir).toBe("desc");
  });
});
