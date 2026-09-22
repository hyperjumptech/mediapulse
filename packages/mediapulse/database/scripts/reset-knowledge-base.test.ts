import { describe, expect, it } from "vitest";

import {
  clearWatermarksSql,
  countSql,
  DATA_TABLES,
  deleteInventedKindAliasesSql,
  deleteInventedKindsSql,
} from "./reset-knowledge-base";

describe("DATA_TABLES", () => {
  it("deletes children before the rows they reference", () => {
    const order = [...DATA_TABLES];

    expect(order.indexOf("knowledge_entity_mention")).toBeLessThan(
      order.indexOf("knowledge_entity"),
    );
    expect(order.indexOf("knowledge_ticker_relation")).toBeLessThan(
      order.indexOf("knowledge_relation"),
    );
    expect(order.indexOf("knowledge_entity_alias")).toBeLessThan(
      order.indexOf("knowledge_entity"),
    );
  });

  it("leaves the relation-kind registry and the run history out", () => {
    expect(DATA_TABLES).not.toContain("knowledge_relation_kind");
    expect(DATA_TABLES).not.toContain("knowledge_extraction_run");
  });
});

describe("deleteInventedKindsSql", () => {
  it("only removes kinds nobody curated", () => {
    expect(deleteInventedKindsSql("mediapulse")).toContain("curated = false");
  });

  it("removes the aliases of those kinds and no others", () => {
    const sql = deleteInventedKindAliasesSql("mediapulse");

    expect(sql).toContain("a.kind_slug = k.slug");
    expect(sql).toContain("k.curated = false");
  });
});

describe("clearWatermarksSql", () => {
  it("resets the resume pointer without touching the counters", () => {
    const sql = clearWatermarksSql("mediapulse");

    expect(sql).toContain("SET watermark_at = NULL");
    expect(sql).not.toContain("DELETE");
  });
});

describe("countSql", () => {
  it("quotes a schema holding a double quote", () => {
    expect(countSql('we"ird', "knowledge_entity")).toContain(
      '"we""ird"."knowledge_entity"',
    );
  });
});
