/**
 * Unit tests for entity detail mapping with provenance evidence.
 */

/** @vitest-environment node */
import { describe, expect, it } from "vitest";
import type { DetailRow } from "./detail-mapper";
import { mapEvidenceRow, mapRowToDetailItem } from "./detail-mapper";

const buildEvidenceRow = (
  overrides: Partial<DetailRow["entityEvidence"][number]> = {},
): DetailRow["entityEvidence"][number] => ({
  id: "evidence-1",
  entityId: "ent-1",
  dataSourceId: "ds-1",
  tickerId: "ticker-1",
  confidence: 0.82,
  createdAt: new Date("2024-05-01T00:00:00.000Z"),
  lastSeenAt: new Date("2024-06-01T00:00:00.000Z"),
  dataSource: {
    id: "ds-1",
    title: "Example article",
    url: "https://example.com/article",
  },
  ...overrides,
});

const buildDetailRow = (
  evidence: DetailRow["entityEvidence"] = [],
): DetailRow =>
  ({
    id: "ent-1",
    typeId: "type-1",
    canonicalName: "Example Co",
    description: "A company",
    metadata: null,
    createdAt: new Date("2024-04-01T00:00:00.000Z"),
    updatedAt: new Date("2024-04-02T00:00:00.000Z"),
    type: { name: "ORG" },
    entityEvidence: evidence,
  }) as DetailRow;

describe("mapEvidenceRow", () => {
  it("maps data source link fields and timestamps", () => {
    const row = buildEvidenceRow();

    const item = mapEvidenceRow(row);

    expect(item).toEqual({
      id: "ds-1",
      title: "Example article",
      url: "https://example.com/article",
      confidence: 0.82,
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
    expect(detail.canonicalName).toBe("Example Co");
    expect(detail.entityTypeName).toBe("ORG");
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
