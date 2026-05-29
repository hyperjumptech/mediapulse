/**
 * Detail payload mapper for entity read views, including provenance evidence rows.
 */

import type { Prisma } from "@mediapulse/database";

/**
 * `include` passed to `entity.findUnique` for Hermes detail pages.
 */
export const detailInclude = {
  type: {
    select: {
      name: true,
    },
  },
  entityEvidence: {
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
} satisfies Prisma.EntityInclude;

/**
 * Prisma row shape for `entity.findUnique` when loading the detail view.
 */
export type DetailRow = Prisma.EntityGetPayload<{
  include: typeof detailInclude;
}>;

/**
 * Maps one entity evidence join row to a Hermes `subTable` item.
 *
 * @param row - Evidence row with joined data source from {@link detailInclude}.
 * @returns Serializable evidence row for the detail payload.
 */
export const mapEvidenceRow = (row: DetailRow["entityEvidence"][number]) => ({
  id: row.dataSource.id,
  title: row.dataSource.title,
  url: row.dataSource.url,
  confidence: row.confidence,
  lastSeenAt: row.lastSeenAt.toISOString(),
});

/** JSON evidence row type; derived from {@link mapEvidenceRow}. */
export type EvidenceItem = ReturnType<typeof mapEvidenceRow>;

/**
 * Maps an entity row to the JSON detail payload (GET by id).
 *
 * @param row - Row from `prisma.entity.findUnique` using {@link detailInclude}.
 * @returns Serializable detail record for the Hermes read-only detail page.
 */
export const mapRowToDetailItem = (row: DetailRow) => ({
  id: row.id,
  typeId: row.typeId,
  entityTypeName: row.type.name,
  canonicalName: row.canonicalName,
  description: row.description,
  metadata: row.metadata,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
  evidence: row.entityEvidence.map(mapEvidenceRow),
});

/** JSON detail item type; derived from {@link mapRowToDetailItem}. */
export type DetailItem = ReturnType<typeof mapRowToDetailItem>;
