import type { MediapulseUser } from "@mediapulse/database";

/**
 * Maps a Prisma Mediapulse user row to the JSON list item.
 *
 * @param row - Row from `prisma.mediapulseUser.findMany` without a custom `select`.
 * @returns Serializable list row for the domain API.
 */
export const mapRowToListItem = (row: MediapulseUser) => ({
  id: row.id,
  email: row.email,
  name: row.name,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

/** JSON list item type; derived from {@link mapRowToListItem}. */
export type ListItem = ReturnType<typeof mapRowToListItem>;
