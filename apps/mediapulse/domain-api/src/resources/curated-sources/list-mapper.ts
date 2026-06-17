/**
 * Maps `CuratedSource` database rows to the list-item shape returned by the curated-sources table API.
 */

import type { CuratedSource } from "@mediapulse/database";

/**
 * Maps a Prisma curated-source row to the JSON list item.
 *
 * @param row - Row from `prisma.curatedSource.findMany` without a custom `select`.
 * @returns Serializable list row for the domain API.
 */
export const mapRowToListItem = (row: CuratedSource) => ({
  id: row.id,
  name: row.name ?? "",
  listingUrl: row.listingUrl,
  linkType: row.linkType === "page" ? "Page" : "Listing",
  enabled: row.enabled ? "Yes" : "No",
  maxItems: row.maxItems == null ? "" : String(row.maxItems),
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

/** JSON list item type; derived from {@link mapRowToListItem}. */
export type ListItem = ReturnType<typeof mapRowToListItem>;
