import { describe, expect, it } from "vitest";

import {
  articleSampleSql,
  issuerSelectionSql,
  seededPartySql,
  toSampleIssuer,
  toSampleParties,
} from "./sample-knowledge-articles";

describe("toSampleParties", () => {
  it("keeps the named company and regulator parties of one issuer", () => {
    const rows = [
      {
        ticker_id: "t1",
        kind: "company",
        name: "Starbucks",
        aliases: ["SBUX"],
      },
      { ticker_id: "t1", kind: "regulator", name: "BPOM", aliases: [] },
      { ticker_id: "t2", kind: "company", name: "Tomoro", aliases: [] },
    ];

    expect(toSampleParties(rows, "t1")).toEqual([
      { name: "Starbucks", aliases: ["SBUX"], kind: "company" },
      { name: "BPOM", aliases: [], kind: "regulator" },
    ]);
  });

  it("drops unnamed parties, other kinds and non-string aliases", () => {
    const rows = [
      { ticker_id: "t1", kind: "company", name: "", aliases: [] },
      { ticker_id: "t1", kind: "person", name: "Someone", aliases: [] },
      {
        ticker_id: "t1",
        kind: "company",
        name: "Kopi Kenangan",
        aliases: [7, "Kenangan"],
      },
    ];

    expect(toSampleParties(rows, "t1")).toEqual([
      { name: "Kopi Kenangan", aliases: ["Kenangan"], kind: "company" },
    ]);
  });
});

describe("articleSampleSql", () => {
  it("only admits articles a Section placed for the issuer", () => {
    expect(articleSampleSql("mediapulse", false)).toContain(
      "s.section IS NOT NULL",
    );
  });

  it("filters on body length only when asked", () => {
    expect(articleSampleSql("mediapulse", true)).toContain(
      "length(ds.content) > 400",
    );
    expect(articleSampleSql("mediapulse", false)).not.toContain(
      "length(ds.content)",
    );
  });

  it("orders by a seeded hash so a re-run picks the same articles", () => {
    expect(articleSampleSql("mediapulse", false)).toContain(
      "ORDER BY md5(ds.id || $3::text)",
    );
  });

  it("quotes a schema holding a double quote", () => {
    expect(articleSampleSql('we"ird', false)).toContain(
      '"we""ird".data_source',
    );
  });
});

describe("issuerSelectionSql", () => {
  it("reads the issuer's aliases and description from the knowledge base", () => {
    const sql = issuerSelectionSql("mediapulse");

    expect(sql).toContain('"mediapulse".knowledge_entity issuer');
    expect(sql).toContain('"mediapulse".knowledge_entity_alias');
    expect(sql).not.toContain("ticker_profile");
    expect(sql).not.toContain("t.aliases");
  });
});

describe("seededPartySql", () => {
  it("reads only the competitors and regulators seeded from the profile", () => {
    const sql = seededPartySql("mediapulse");

    expect(sql).toContain("link.source = 'profile'");
    expect(sql).toContain("link.is_issuer = false");
    expect(sql).toContain("entity.kind IN ('company', 'regulator')");
  });
});

describe("toSampleIssuer", () => {
  it("takes the issuer's aliases from the knowledge base", () => {
    const issuer = toSampleIssuer(
      {
        id: "t1",
        symbol: "FORE",
        name: "Fore Kopi Indonesia",
        issuer_aliases: ["Fore Coffee", 7],
        company_overview: "App-led coffee chain.",
      },
      [],
    );

    expect(issuer).toEqual({
      tickerId: "t1",
      symbol: "FORE",
      name: "Fore Kopi Indonesia",
      aliases: ["Fore Coffee"],
      companyOverview: "App-led coffee chain.",
      parties: [],
    });
  });

  it("falls back to no aliases when the issuer has no knowledge base entity", () => {
    const issuer = toSampleIssuer(
      {
        id: "t2",
        symbol: "NEW",
        name: "New Company",
        issuer_aliases: null,
        company_overview: null,
      },
      [],
    );

    expect(issuer.aliases).toEqual([]);
    expect(issuer.companyOverview).toBeNull();
  });
});
