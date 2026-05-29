/**
 * Unit tests for entity-relation detail mapping with provenance evidence.
 */

/** @vitest-environment node */
import { describe, expect, it } from "vitest";
import type { DetailRow } from "./detail-mapper";
import { mapEvidenceRow, mapRowToDetailItem } from "./detail-mapper";

const buildEvidenceRow = (
  overrides: Partial<DetailRow["evidence"][number]> = {},
): DetailRow["evidence"][number] => ({
  id: "evidence-1",
  entityRelationId: "rel-1",
  dataSourceId: "ds-1",
  tickerId: "ticker-1",
  confidence: 0.91,
  evidenceSpan: "Company A acquired Company B",
  createdAt: new Date("2024-05-01T00:00:00.000Z"),
  lastSeenAt: new Date("2024-06-01T00:00:00.000Z"),
  dataSource: {
    id: "ds-1",
    title: "Acquisition report",
    url: "https://example.com/acquisition",
  },
  ...overrides,
});

const buildDetailRow = (evidence: DetailRow["evidence"] = []): DetailRow =>
  ({
    id: "rel-1",
    fromEntityId: "from-1",
    toEntityId: "to-1",
    relationTypeId: "type-1",
    weight: 0.75,
    lastSeenAt: new Date("2024-08-01T00:00:00.000Z"),
    createdAt: new Date("2024-07-01T00:00:00.000Z"),
    fromEntity: { id: "from-1", canonicalName: "Parent Inc" },
    toEntity: { id: "to-1", canonicalName: "Child LLC" },
    relationType: { name: "SUBSIDIARY_OF" },
    evidence,
  }) as DetailRow;

describe("mapEvidenceRow", () => {
  it("maps data source link fields and timestamps", () => {
    const item = mapEvidenceRow(buildEvidenceRow());

    expect(item).toEqual({
      id: "ds-1",
      title: "Acquisition report",
      url: "https://example.com/acquisition",
      confidence: 0.91,
      lastSeenAt: "2024-06-01T00:00:00.000Z",
    });
  });

  it("preserves null confidence", () => {
    const item = mapEvidenceRow(buildEvidenceRow({ confidence: null }));

    expect(item.confidence).toBeNull();
  });
});

describe("mapRowToDetailItem", () => {
  it("returns empty evidence when none is linked", () => {
    const detail = mapRowToDetailItem(buildDetailRow());

    expect(detail.evidence).toEqual([]);
    expect(detail.fromEntityName).toBe("Parent Inc");
    expect(detail.relationTypeName).toBe("SUBSIDIARY_OF");
  });

  it("maps multiple evidence rows in query order", () => {
    const detail = mapRowToDetailItem(
      buildDetailRow([
        buildEvidenceRow({
          id: "evidence-newer",
          lastSeenAt: new Date("2024-07-01T00:00:00.000Z"),
          dataSource: {
            id: "ds-newer",
            title: "Newer article",
            url: "https://example.com/newer",
          },
        }),
        buildEvidenceRow({
          id: "evidence-older",
          lastSeenAt: new Date("2024-05-01T00:00:00.000Z"),
          dataSource: {
            id: "ds-older",
            title: "Older article",
            url: "https://example.com/older",
          },
        }),
      ]),
    );

    expect(detail.evidence).toHaveLength(2);
    expect(detail.evidence[0]?.id).toBe("ds-newer");
    expect(detail.evidence[1]?.id).toBe("ds-older");
  });
});
