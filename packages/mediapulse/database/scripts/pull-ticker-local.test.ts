import { describe, expect, it } from "vitest";

import {
  articleSelectionSql,
  parseSourceUrl,
  quoteIdentifier,
  remapTickerId,
  toDataSourceUpsert,
  toPlacementUpsert,
} from "./pull-ticker-local";

const LOCAL_TICKER = "local-ticker";
const SOURCE_TICKER = "source-ticker";

describe("parseSourceUrl", () => {
  it("strips Prisma's schema parameter and reports the schema it named", () => {
    const parsed = parseSourceUrl(
      "postgresql://user:pass@host:6543/postgres?schema=mediapulse",
    );

    expect(parsed.schema).toBe("mediapulse");
    expect(parsed.connectionString).not.toContain("schema=");
  });

  it("defaults to the Mediapulse schema when the URL names none", () => {
    expect(parseSourceUrl("postgresql://user:pass@host:5432/db").schema).toBe(
      "mediapulse",
    );
  });

  it("prefers an explicit override", () => {
    const parsed = parseSourceUrl(
      "postgresql://user:pass@host:5432/db?schema=mediapulse",
      "public",
    );

    expect(parsed.schema).toBe("public");
  });
});

describe("quoteIdentifier", () => {
  it("quotes a plain schema name", () => {
    expect(quoteIdentifier("mediapulse")).toBe('"mediapulse"');
  });

  it("refuses anything that is not a plain identifier", () => {
    expect(() => quoteIdentifier('public"; drop table ticker; --')).toThrow(
      /Refusing/u,
    );
  });
});

describe("articleSelectionSql", () => {
  it("selects by the issuer's own articles and by its Placements", () => {
    const sql = articleSelectionSql("mediapulse");

    expect(sql).toContain('"mediapulse".data_source ds');
    expect(sql).toContain('"mediapulse".data_source_ticker_section s');
    expect(sql).toContain("ds.ticker_id = $1");
  });
});

describe("remapTickerId", () => {
  it("rewrites the pulled issuer's own id to the local one", () => {
    expect(remapTickerId(SOURCE_TICKER, SOURCE_TICKER, LOCAL_TICKER)).toBe(
      LOCAL_TICKER,
    );
  });

  it("drops another issuer's provenance rather than claiming it", () => {
    expect(
      remapTickerId("someone-else", SOURCE_TICKER, LOCAL_TICKER),
    ).toBeNull();
  });

  it("leaves an article with no issuer unattributed", () => {
    expect(remapTickerId(null, SOURCE_TICKER, LOCAL_TICKER)).toBeNull();
  });
});

describe("toDataSourceUpsert", () => {
  const row = {
    id: "article-1",
    url: "https://example.test/a",
    canonical_url: "https://example.test/a",
    title: "Fore opens ten stores",
    description: "A description",
    content: null,
    ticker_id: SOURCE_TICKER,
    search_query_id: "query-1",
    curated_source_id: "curated-1",
    registrable_domain: "example.test",
    published_at: new Date("2026-09-01T00:00:00.000Z"),
    section: "quickHits",
    section_score: 0.8,
  };

  it("keeps the source id so a re-run refreshes the same row", () => {
    const upsert = toDataSourceUpsert(row, LOCAL_TICKER, SOURCE_TICKER);

    expect(upsert.where).toStrictEqual({ id: "article-1" });
    expect(upsert.create.id).toBe("article-1");
  });

  it("drops the foreign keys this script does not copy", () => {
    const upsert = toDataSourceUpsert(row, LOCAL_TICKER, SOURCE_TICKER);

    expect(upsert.create).not.toHaveProperty("searchQueryId");
    expect(upsert.create).not.toHaveProperty("curatedSourceId");
  });

  it("falls back to the URL when a row carries no canonical URL", () => {
    const upsert = toDataSourceUpsert(
      { ...row, canonical_url: null },
      LOCAL_TICKER,
      SOURCE_TICKER,
    );

    expect(upsert.create.canonicalUrl).toBe("https://example.test/a");
  });

  it("refuses a row with no id", () => {
    expect(() =>
      toDataSourceUpsert({ ...row, id: null }, LOCAL_TICKER, SOURCE_TICKER),
    ).toThrow(/no id/u);
  });
});

describe("toPlacementUpsert", () => {
  it("keys on the article and the local ticker", () => {
    const upsert = toPlacementUpsert(
      {
        data_source_id: "article-1",
        section: "competitiveLandscape",
        section_score: 0.7,
        section_reason: "names a peer",
        analyzed_at: new Date("2026-09-02T00:00:00.000Z"),
      },
      LOCAL_TICKER,
    );

    expect(upsert.where).toStrictEqual({
      dataSourceId_tickerId: {
        dataSourceId: "article-1",
        tickerId: LOCAL_TICKER,
      },
    });
    expect(upsert.create.section).toBe("competitiveLandscape");
  });

  it("refuses a placement with no article", () => {
    expect(() =>
      toPlacementUpsert({ data_source_id: null }, LOCAL_TICKER),
    ).toThrow(/no article/u);
  });
});
