import type { Publisher } from "@mediapulse/database";

import { publisherNameSourceLabels } from "./name-source-labels";

export const mapRowToListItem = (row: Publisher) => ({
  id: row.id,
  displayName: row.displayName,
  domain: row.domain,
  nameSource: row.nameSource,
  nameSourceLabel: publisherNameSourceLabels[row.nameSource],
  lastSeenAt: row.lastSeenAt.toISOString(),
});

export type ListItem = ReturnType<typeof mapRowToListItem>;
