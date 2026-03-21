import type { DataSourceExpansion } from "@mediapulse/database";

/**
 * Maps a Prisma data-source expansion row to the JSON list item.
 *
 * @param row - Row from `prisma.dataSourceExpansion.findMany` without a custom `select`.
 * @returns Serializable list row for the domain API.
 */
export const mapRowToListItem = (row: DataSourceExpansion) => ({
  id: row.id,
  name: row.name,
  expansionString: row.expansionString,
  description: row.description,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

/** JSON list item type; derived from {@link mapRowToListItem}. */
export type ListItem = ReturnType<typeof mapRowToListItem>;
