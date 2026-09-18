/** @vitest-environment node */
import { describe, expect, it } from "vitest";

import {
  buildKnowledgeBaseListOrderBy,
  buildKnowledgeBaseListWhere,
  parseKnowledgeBaseSortBy,
} from "./list-filters";

describe("buildKnowledgeBaseListWhere", () => {
  it("lists only issuers that hold an entity", () => {
    const where = buildKnowledgeBaseListWhere({});

    expect(where.knowledgeTickerEntities).toStrictEqual({ some: {} });
    expect(where.OR).toBeUndefined();
  });

  it("searches the symbol and the issuer name", () => {
    const where = buildKnowledgeBaseListWhere({ q: " fore " });

    expect(where.OR).toStrictEqual([
      { symbol: { contains: "fore", mode: "insensitive" } },
      { name: { contains: "fore", mode: "insensitive" } },
    ]);
  });

  it("ignores an empty search", () => {
    expect(buildKnowledgeBaseListWhere({ q: "   " }).OR).toBeUndefined();
  });
});

describe("parseKnowledgeBaseSortBy", () => {
  it("accepts a field this resource can order by", () => {
    expect(parseKnowledgeBaseSortBy("entityCount")).toBe("entityCount");
  });

  it("falls back to the symbol for anything else", () => {
    expect(parseKnowledgeBaseSortBy("nonsense")).toBe("symbol");
    expect(parseKnowledgeBaseSortBy(undefined)).toBe("symbol");
  });
});

describe("buildKnowledgeBaseListOrderBy", () => {
  it("orders by the size of the knowledge base through the membership count", () => {
    expect(buildKnowledgeBaseListOrderBy("entityCount", "desc")).toStrictEqual({
      knowledgeTickerEntities: { _count: "desc" },
    });
  });

  it("orders by symbol and name directly", () => {
    expect(buildKnowledgeBaseListOrderBy("symbol", "asc")).toStrictEqual({
      symbol: "asc",
    });
    expect(buildKnowledgeBaseListOrderBy("name", "desc")).toStrictEqual({
      name: "desc",
    });
  });
});
