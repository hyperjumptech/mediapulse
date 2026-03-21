import type { RelationType } from "@mediapulse/database";

/**
 * Maps a Prisma relation-type row to the JSON list item.
 *
 * @param row - Row from `prisma.relationType.findMany` without a custom `select`.
 * @returns Serializable list row for the domain API.
 */
export const mapRowToListItem = (row: RelationType) => ({
  id: row.id,
  name: row.name,
  description: row.description,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

/** JSON list item type; derived from {@link mapRowToListItem}. */
export type ListItem = ReturnType<typeof mapRowToListItem>;
