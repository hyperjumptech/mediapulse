import { describe, expect, it } from "vitest";

import {
  buildDomainTableFilterExtraParams,
  buildDomainTableListParams,
  buildDomainTablePreserveParams,
  parseDomainTableFilterValues,
  resolveDomainTableListSort,
} from "./domain-table-list-params";

const newslettersMeta = {
  sortableFields: ["createdAt", "subject"],
  defaultSort: { sortBy: "createdAt", sortDir: "desc" as const },
  listFilters: [
    {
      key: "tickerId",
      label: "Ticker",
      ui: "select" as const,
      optionsMetaKey: "tickerOptions",
    },
    {
      key: "createdAt",
      label: "Created",
      ui: "date-range" as const,
      rangeParams: { from: "from", to: "to" },
    },
  ],
};

const searchQueryFilters = [
  {
    key: "intent",
    label: "Intent",
    ui: "select" as const,
    optionsMetaKey: "intentOptions",
  },
  {
    key: "source",
    label: "Source",
    ui: "select" as const,
    optionsMetaKey: "sourceOptions",
  },
  {
    key: "collectionSource",
    label: "Collected by",
    ui: "select" as const,
    optionsMetaKey: "collectionSourceOptions",
  },
  {
    key: "isActive",
    label: "Active set",
    ui: "boolean-select" as const,
  },
];

describe("resolveDomainTableListSort", () => {
  it("uses defaultSort when URL omits sort", () => {
    expect(resolveDomainTableListSort({}, newslettersMeta)).toEqual({
      sortBy: "createdAt",
      sortDir: "desc",
    });
  });

  it("honors URL sort when field is sortable", () => {
    expect(
      resolveDomainTableListSort(
        { sort: "subject", dir: "asc" },
        newslettersMeta,
      ),
    ).toEqual({ sortBy: "subject", sortDir: "asc" });
  });

  it("ignores unknown sort fields and falls back to defaultSort", () => {
    expect(
      resolveDomainTableListSort({ sort: "unknown" }, newslettersMeta),
    ).toEqual({ sortBy: "createdAt", sortDir: "desc" });
  });
});

describe("parseDomainTableFilterValues", () => {
  it("parses select, boolean, and date-range filters from search params", () => {
    expect(
      parseDomainTableFilterValues(
        {
          tickerId: "11111111-1111-4111-a111-111111111111",
          from: "2026-05-01",
          to: "2026-05-31",
          intent: "breaking",
          source: "llm",
          collectionSource: "page-collection",
          isActive: "true",
        },
        [...newslettersMeta.listFilters, ...searchQueryFilters],
      ),
    ).toEqual({
      tickerId: "11111111-1111-4111-a111-111111111111",
      from: "2026-05-01",
      to: "2026-05-31",
      intent: "breaking",
      source: "llm",
      collectionSource: "page-collection",
      isActive: "true",
    });
  });
});

describe("buildDomainTableListParams", () => {
  it("parses filters and default sort together", () => {
    expect(
      buildDomainTableListParams(
        {
          tickerId: "11111111-1111-4111-a111-111111111111",
          from: "2026-05-01",
          to: "2026-05-31",
        },
        newslettersMeta,
      ),
    ).toMatchObject({
      filters: {
        tickerId: "11111111-1111-4111-a111-111111111111",
        from: "2026-05-01",
        to: "2026-05-31",
      },
      sortBy: "createdAt",
      sortDir: "desc",
    });
  });
});

describe("buildDomainTablePreserveParams", () => {
  it("includes sort and filter keys for link preservation", () => {
    expect(
      buildDomainTablePreserveParams({
        page: 1,
        pageSize: 15,
        sortBy: "createdAt",
        sortDir: "desc",
        filters: {
          tickerId: "t1",
          from: "2026-05-01",
        },
      }),
    ).toEqual({
      tickerId: "t1",
      from: "2026-05-01",
      sort: "createdAt",
      dir: "desc",
    });
  });
});

describe("buildDomainTableFilterExtraParams", () => {
  it("omits empty filter values", () => {
    expect(buildDomainTableFilterExtraParams({})).toEqual({});
  });

  it("returns filter entries when set", () => {
    expect(
      buildDomainTableFilterExtraParams({
        intent: "breaking",
        source: "llm",
        collectionSource: "data-collection",
        isActive: "false",
      }),
    ).toEqual({
      intent: "breaking",
      source: "llm",
      collectionSource: "data-collection",
      isActive: "false",
    });
  });
});
