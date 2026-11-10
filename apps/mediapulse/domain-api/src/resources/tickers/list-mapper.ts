import type { Ticker } from "@mediapulse/database";

export const mapRowToListItem = (row: Ticker) => ({
  id: row.id,
  symbol: row.symbol,
  name: row.name,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

export type ListItem = ReturnType<typeof mapRowToListItem>;
