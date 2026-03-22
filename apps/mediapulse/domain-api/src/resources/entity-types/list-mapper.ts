/**
 * Maps `EntityType` database rows to the list-item shape returned by the entity-types table API and used in the UI.
 */

import type { EntityType } from "@mediapulse/database";

/**
 * Maps a Prisma entity-type row to the JSON list item.
 *
 * @param row - Row from `prisma.entityType.findMany` without a custom `select`.
 * @returns Serializable list row for the domain API.
 */
export const mapRowToListItem = (row: EntityType) => ({
  id: row.id,
  name: row.name,
  description: row.description,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

/** JSON list item type; derived from {@link mapRowToListItem}. */
export type ListItem = ReturnType<typeof mapRowToListItem>;
