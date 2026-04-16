/** @vitest-environment node */
import { describe, expect, it } from "vitest";

import {
  applyPerArticleArticleMentionCap,
  applyPerRunArticleEntityCap,
  buildArticleEntityPostChunks,
  buildNormalizedEntityCatalogForArticle,
  buildNormalizedEntityCatalogFromProposals,
  dedupeArticleEntityMentions,
  filterArticleEntityRowsToRunCatalog,
  filterMentionsToArticleEntityCatalog,
  toArticleEntityRowsForSource,
} from "./analysis-article-mentions.js";

const TYPE_ID = "11111111-1111-4111-a111-111111111111";
const DS = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

describe("buildNormalizedEntityCatalogForArticle", () => {
  it("includes normalized canonical and aliases", () => {
    // Setup
    const entities = [
      {
        canonicalName: "Acme Corp",
        typeId: TYPE_ID,
        aliases: ["ACME"],
      },
    ];
    // Act
    const set = buildNormalizedEntityCatalogForArticle(entities);
    // Assert
    expect(set.has("acme corp")).toBe(true);
    expect(set.has("acme")).toBe(true);
  });
});

describe("buildNormalizedEntityCatalogFromProposals", () => {
  it("matches per-article catalog for the same entities", () => {
    // Act
    const a = buildNormalizedEntityCatalogFromProposals([
      { canonicalName: "X", typeId: TYPE_ID, aliases: [] },
    ]);
    const b = buildNormalizedEntityCatalogForArticle([
      { canonicalName: "X", typeId: TYPE_ID, aliases: [] },
    ]);
    // Assert
    expect([...a].sort()).toEqual([...b].sort());
  });
});

describe("filterMentionsToArticleEntityCatalog", () => {
  it("keeps only mentions in the allowed set", () => {
    // Setup
    const allowed = new Set(["foo"]);
    // Act
    const out = filterMentionsToArticleEntityCatalog(
      [
        { entityName: "Foo", mentionCount: 1, confidence: 0.9 },
        { entityName: "Bar", mentionCount: 1, confidence: 0.5 },
      ],
      allowed,
    );
    // Assert
    expect(out).toHaveLength(1);
    expect(out[0]?.entityName).toBe("Foo");
  });
});

describe("applyPerArticleArticleMentionCap", () => {
  it("truncates to max in input order", () => {
    // Act
    const out = applyPerArticleArticleMentionCap(
      [
        { entityName: "a", mentionCount: 1, confidence: 1 },
        { entityName: "b", mentionCount: 1, confidence: 1 },
        { entityName: "c", mentionCount: 1, confidence: 1 },
      ],
      2,
    );
    // Assert
    expect(out.map((m) => m.entityName)).toEqual(["a", "b"]);
  });
});

describe("toArticleEntityRowsForSource", () => {
  it("injects dataSourceId and trims entityName", () => {
    // Act
    const rows = toArticleEntityRowsForSource(DS, [
      {
        entityName: "  Foo  ",
        mentionCount: 2,
        confidence: 0.7,
        sentiment: "POSITIVE",
      },
    ]);
    // Assert
    expect(rows).toEqual([
      {
        dataSourceId: DS,
        entityName: "Foo",
        mentionCount: 2,
        confidence: 0.7,
        sentiment: "POSITIVE",
      },
    ]);
  });
});

describe("filterArticleEntityRowsToRunCatalog", () => {
  it("drops rows not in run catalog", () => {
    // Setup
    const catalog = new Set(["foo"]);
    // Act
    const { rows, droppedCount } = filterArticleEntityRowsToRunCatalog(
      [
        {
          dataSourceId: DS,
          entityName: "Foo",
          mentionCount: 1,
          confidence: 0.5,
        },
        {
          dataSourceId: DS,
          entityName: "Bar",
          mentionCount: 1,
          confidence: 0.5,
        },
      ],
      catalog,
    );
    // Assert
    expect(droppedCount).toBe(1);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.entityName).toBe("Foo");
  });
});

describe("dedupeArticleEntityMentions", () => {
  it("sums mentionCount and maxes confidence", () => {
    // Act
    const rows = dedupeArticleEntityMentions([
      {
        dataSourceId: DS,
        entityName: "Foo",
        mentionCount: 2,
        confidence: 0.3,
        sentiment: "NEGATIVE",
      },
      {
        dataSourceId: DS,
        entityName: "FOO",
        mentionCount: 1,
        confidence: 0.9,
      },
    ]);
    // Assert
    expect(rows).toHaveLength(1);
    expect(rows[0]?.mentionCount).toBe(3);
    expect(rows[0]?.confidence).toBe(0.9);
    expect(rows[0]?.sentiment).toBe("NEGATIVE");
  });
});

describe("applyPerRunArticleEntityCap", () => {
  it("truncates after dedupe", () => {
    // Act
    const out = applyPerRunArticleEntityCap(
      [
        {
          dataSourceId: DS,
          entityName: "a",
          mentionCount: 1,
          confidence: 1,
        },
        {
          dataSourceId: DS,
          entityName: "b",
          mentionCount: 1,
          confidence: 1,
        },
      ],
      1,
    );
    // Assert
    expect(out).toHaveLength(1);
    expect(out[0]?.entityName).toBe("a");
  });
});

describe("buildArticleEntityPostChunks", () => {
  it("partitions rows and passes safeParse", () => {
    // Setup
    const rows = [
      {
        dataSourceId: DS,
        entityName: "Foo",
        mentionCount: 1,
        confidence: 0.5,
      },
      {
        dataSourceId: DS,
        entityName: "Bar",
        mentionCount: 2,
        confidence: 0.8,
      },
    ];
    // Act
    const { chunks, parseErrors } = buildArticleEntityPostChunks(
      "ticker-1",
      rows,
      1,
    );
    // Assert
    expect(parseErrors).toHaveLength(0);
    expect(chunks).toHaveLength(2);
    expect(chunks[0]?.articleEntities).toHaveLength(1);
    expect(chunks[0]?.entities).toHaveLength(0);
    expect(chunks[0]?.articleRelevances).toHaveLength(0);
  });
});
