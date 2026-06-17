/**
 * Detail payload mapper for curated-source read and edit views.
 */

import type { CuratedSource } from "@mediapulse/database";

/**
 * Maps a curated-source row to the Hermes detail / edit payload.
 *
 * @param row - Row from `prisma.curatedSource.findUnique`.
 * @returns Serializable detail record for GET by id and update forms.
 */
export const mapRowToDetailItem = (row: CuratedSource) => ({
  id: row.id,
  name: row.name ?? "",
  listingUrl: row.listingUrl,
  enabled: row.enabled,
  maxItems: row.maxItems,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

/** JSON detail item type; derived from {@link mapRowToDetailItem}. */
export type DetailItem = ReturnType<typeof mapRowToDetailItem>;
