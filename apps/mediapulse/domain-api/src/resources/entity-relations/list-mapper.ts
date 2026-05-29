/**
 * Prisma `include` for entity-relation list/detail rows and mappers to list and detail JSON.
 */

import type { Prisma } from "@mediapulse/database";

/**
 * `include` passed to `entityRelation.findMany` / `findUnique` for list and detail views.
 */
export const listInclude = {
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
} satisfies Prisma.EntityRelationInclude;

/**
 * Prisma row shape for `entityRelation.findMany` when loading the list view.
 */
export type ListRow = Prisma.EntityRelationGetPayload<{
  include: typeof listInclude;
}>;

/**
 * Maps an entity-relation row to the JSON list item.
 *
 * @param row - Row from `prisma.entityRelation.findMany` using {@link listInclude}.
 * @returns Serializable list row for the domain API.
 */
export const mapRowToListItem = (row: ListRow) => ({
  id: row.id,
  fromEntityName: row.fromEntity.canonicalName,
  toEntityName: row.toEntity.canonicalName,
  relationTypeName: row.relationType.name,
  weight: row.weight,
  lastSeenAt: row.lastSeenAt.toISOString(),
  createdAt: row.createdAt.toISOString(),
});

/** JSON list item type; derived from {@link mapRowToListItem}. */
export type ListItem = ReturnType<typeof mapRowToListItem>;
