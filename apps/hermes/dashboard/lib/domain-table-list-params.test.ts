import { describe, expect, it } from "vitest";

import {
  buildDomainTableFilterExtraParams,
  buildDomainTableListParams,
  buildDomainTablePreserveParams,
  resolveDomainTableListSort,
} from "./domain-table-list-params";

const newslettersMeta = {
  sortableFields: ["createdAt", "subject"],
  defaultSort: { sortBy: "createdAt", sortDir: "desc" as const },
};

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
      tickerId: "11111111-1111-4111-a111-111111111111",
      from: "2026-05-01",
      to: "2026-05-31",
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
        tickerId: "t1",
        from: "2026-05-01",
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
});
