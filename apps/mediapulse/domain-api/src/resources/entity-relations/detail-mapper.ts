/**
 * Detail payload mapper for entity-relation read views, including provenance evidence rows.
 */

import type { Prisma } from "@mediapulse/database";

/**
 * `include` passed to `entityRelation.findUnique` for Hermes detail pages.
 */
export const detailInclude = {
  fromEntity: {
    select: {
      id: true,
      canonicalName: true,
    },
  },
  toEntity: {
    select: {
      id: true,
      canonicalName: true,
    },
  },
  relationType: {
    select: {
      name: true,
    },
  },
  evidence: {
    orderBy: {
      lastSeenAt: "desc" as const,
    },
    include: {
      dataSource: {
        select: {
          id: true,
          title: true,
          url: true,
        },
      },
    },
  },
} satisfies Prisma.EntityRelationInclude;

/**
 * Prisma row shape for `entityRelation.findUnique` when loading the detail view.
 */
export type DetailRow = Prisma.EntityRelationGetPayload<{
  include: typeof detailInclude;
}>;

/**
 * Maps one relation evidence join row to a Hermes `subTable` item.
 *
 * @param row - Evidence row with joined data source from {@link detailInclude}.
 * @returns Serializable evidence row for the detail payload.
 */
export const mapEvidenceRow = (row: DetailRow["evidence"][number]) => ({
  id: row.dataSource.id,
  title: row.dataSource.title,
  url: row.dataSource.url,
  confidence: row.confidence,
  lastSeenAt: row.lastSeenAt.toISOString(),
});

/** JSON evidence row type; derived from {@link mapEvidenceRow}. */
export type EvidenceItem = ReturnType<typeof mapEvidenceRow>;

/**
 * Maps an entity-relation row to the JSON detail payload (GET by id).
 *
 * @param row - Row from `prisma.entityRelation.findUnique` using {@link detailInclude}.
 * @returns Serializable detail record for the Hermes read-only detail page.
 */
export const mapRowToDetailItem = (row: DetailRow) => ({
  id: row.id,
  fromEntityId: row.fromEntityId,
  toEntityId: row.toEntityId,
  relationTypeId: row.relationTypeId,
  fromEntityName: row.fromEntity.canonicalName,
  toEntityName: row.toEntity.canonicalName,
  relationTypeName: row.relationType.name,
  weight: row.weight,
  lastSeenAt: row.lastSeenAt.toISOString(),
  createdAt: row.createdAt.toISOString(),
  evidence: row.evidence.map(mapEvidenceRow),
});

/** JSON detail item type; derived from {@link mapRowToDetailItem}. */
export type DetailItem = ReturnType<typeof mapRowToDetailItem>;
