/**
 * Maps `Ticker` rows (structured classification columns + raw metadata blob) to list items for the tickers Hermes table API.
 */

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
  sector: row.sector ?? "",
  industry: row.industry ?? "",
  subSector: row.subSector ?? "",
  subIndustry: row.subIndustry ?? "",
  businessActivity: row.businessActivity ?? "",
  metadataRaw:
    row.metadataRaw === null || row.metadataRaw === undefined
      ? ""
      : JSON.stringify(row.metadataRaw, null, 2),
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

/** JSON list item type; derived from {@link mapRowToListItem}. */
export type ListItem = ReturnType<typeof mapRowToListItem>;
