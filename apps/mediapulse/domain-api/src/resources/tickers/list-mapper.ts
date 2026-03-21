import type { Ticker } from "@mediapulse/database";

/**
 * Maps a Prisma ticker row to the JSON list item.
 *
 * @param row - Row from `prisma.ticker.findMany` without a custom `select`.
 * @returns Serializable list row for the domain API.
 */
export const mapRowToListItem = (row: Ticker) => ({
  id: row.id,
  symbol: row.symbol,
  name: row.name,
  metadata:
    row.metadata === null || row.metadata === undefined
      ? ""
      : JSON.stringify(row.metadata, null, 2),
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

/** JSON list item type; derived from {@link mapRowToListItem}. */
export type ListItem = ReturnType<typeof mapRowToListItem>;
