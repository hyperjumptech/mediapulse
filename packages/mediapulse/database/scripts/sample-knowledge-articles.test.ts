import { describe, expect, it } from "vitest";

import {
  articleSampleSql,
  asParties,
  issuerSelectionSql,
} from "./sample-knowledge-articles";

describe("asParties", () => {
  it("keeps named parties and tags them with the kind", () => {
    const parties = asParties(
      [{ name: "Starbucks", aliases: ["SBUX"] }, { name: "Tomoro" }],
      "company",
    );

    expect(parties).toEqual([
      { name: "Starbucks", aliases: ["SBUX"], kind: "company" },
      { name: "Tomoro", aliases: [], kind: "company" },
    ]);
  });

  it("drops entries that carry no usable name", () => {
    expect(
      asParties([{ name: "" }, { aliases: ["x"] }, null, 7], "regulator"),
    ).toEqual([]);
  });

  it("returns nothing for a non-array", () => {
    expect(asParties(null, "company")).toEqual([]);
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
  it("reads the profile aliases and parties alongside the ticker", () => {
    const sql = issuerSelectionSql("mediapulse");

    expect(sql).toContain("p.competitors");
    expect(sql).toContain("p.regulators");
    expect(sql).toContain("LEFT JOIN");
  });
});
