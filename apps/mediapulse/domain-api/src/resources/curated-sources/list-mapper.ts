import type { CuratedSource } from "@mediapulse/database";

export const mapRowToListItem = (row: CuratedSource) => ({
  id: row.id,
  name: row.name ?? "",
  listingUrl: row.listingUrl,
  linkType: row.linkType,
  enabled: row.enabled,
  maxItems: row.maxItems,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

export type ListItem = ReturnType<typeof mapRowToListItem>;
