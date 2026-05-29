/** @vitest-environment node */
import { describe, expect, it } from "vitest";

import {
  canonicalizeEntityEvidenceRowsToRunEntities,
  canonicalizeRelationEvidenceRowsToRunEntities,
  dedupeEntityEvidence,
  dedupeRelationEvidence,
  filterEntityEvidenceRowsToRunCatalog,
  filterRelationEvidenceRowsToRunCatalog,
  toEntityEvidenceRowsForSource,
  toRelationEvidenceRowsForSource,
} from "./analysis-provenance.js";

const DS = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const RID = "22222222-2222-4222-a222-222222222222";

describe("toEntityEvidenceRowsForSource", () => {
  it("maps capped entities and uses max mention confidence", () => {
    // Setup
    const entities = [
      { canonicalName: "Apple Inc", typeId: "t1", aliases: ["Apple"] },
    ];
    const mentions = [
      {
        entityName: "Apple",
        mentionCount: 2,
        confidence: 0.7,
        sentiment: null,
      },
      {
        entityName: "Apple Inc",
        mentionCount: 1,
        confidence: 0.9,
        sentiment: null,
      },
    ];

    // Act
    const rows = toEntityEvidenceRowsForSource(DS, entities, mentions);

    // Assert
    expect(rows).toEqual([
      {
        dataSourceId: DS,
        entityName: "Apple Inc",
        confidence: 0.9,
      },
    ]);
  });
});

describe("toRelationEvidenceRowsForSource", () => {
  it("includes critique evidenceSpan when provided", () => {
    // Setup
    const relations = [
      {
        fromEntityName: "A",
        toEntityName: "B",
        relationTypeId: RID,
      },
    ];
    const evidenceByKey = new Map([["A\0B\0" + RID, "quoted span"]]);

    // Act
    const rows = toRelationEvidenceRowsForSource(DS, relations, evidenceByKey);

    // Assert
    expect(rows[0]?.evidenceSpan).toBe("quoted span");
  });
});

describe("dedupeEntityEvidence", () => {
  it("keeps max confidence for duplicate source and entity", () => {
    // Act
    const rows = dedupeEntityEvidence([
      { dataSourceId: DS, entityName: "Acme", confidence: 0.4 },
      { dataSourceId: DS, entityName: "acme", confidence: 0.8 },
    ]);

    // Assert
    expect(rows).toHaveLength(1);
    expect(rows[0]?.confidence).toBe(0.8);
  });
});

describe("filter and canonicalize entity evidence", () => {
  it("drops rows outside run catalog and canonicalizes names", () => {
    // Setup
    const catalog = new Set(["apple inc", "apple"]);
    const entities = [
      { canonicalName: "Apple Inc", typeId: "t1", aliases: ["Apple"] },
    ];
    const rows = [
      { dataSourceId: DS, entityName: "Apple", confidence: 0.5 },
      { dataSourceId: DS, entityName: "Ghost", confidence: 0.5 },
    ];

    // Act
    const filtered = filterEntityEvidenceRowsToRunCatalog(rows, catalog);
    const canonical = canonicalizeEntityEvidenceRowsToRunEntities(
      filtered.rows,
      entities,
    );

    // Assert
    expect(filtered.droppedCount).toBe(1);
    expect(canonical.rows).toEqual([
      { dataSourceId: DS, entityName: "Apple Inc", confidence: 0.5 },
    ]);
  });
});

describe("filter and canonicalize relation evidence", () => {
  it("drops rows with unknown endpoints and canonicalizes names", () => {
    // Setup
    const catalog = new Set(["a", "b"]);
    const entities = [
      { canonicalName: "A Corp", typeId: "t1", aliases: ["A"] },
      { canonicalName: "B Corp", typeId: "t1", aliases: ["B"] },
    ];
    const rows = [
      {
        dataSourceId: DS,
        fromEntityName: "A",
        toEntityName: "B",
        relationTypeId: RID,
      },
      {
        dataSourceId: DS,
        fromEntityName: "A",
        toEntityName: "Missing",
        relationTypeId: RID,
      },
    ];

    // Act
    const filtered = filterRelationEvidenceRowsToRunCatalog(rows, catalog);
    const canonical = canonicalizeRelationEvidenceRowsToRunEntities(
      filtered.rows,
      entities,
    );
    const deduped = dedupeRelationEvidence(canonical.rows);

    // Assert
    expect(filtered.droppedCount).toBe(1);
    expect(deduped).toEqual([
      {
        dataSourceId: DS,
        fromEntityName: "A Corp",
        toEntityName: "B Corp",
        relationTypeId: RID,
      },
    ]);
  });
});
