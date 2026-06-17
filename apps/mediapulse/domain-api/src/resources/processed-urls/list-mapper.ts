import type { Prisma } from "@mediapulse/database";

/** Prisma include for collection-url-outcome rows (ticker symbol for display). */
export const listInclude = {
  ticker: {
    select: { symbol: true },
  },
  curatedSource: {
    select: { id: true, name: true, listingUrl: true },
  },
} satisfies Prisma.CollectionUrlOutcomeInclude;

/** Prisma row shape for `collectionUrlOutcome.findMany` when loading the list view. */
export type ListRow = Prisma.CollectionUrlOutcomeGetPayload<{
  include: typeof listInclude;
}>;

/**
 * Maps a `CollectionUrlOutcome` row to the JSON list item served to the Hermes dashboard.
 *
 * @param row - Row from `prisma.collectionUrlOutcome.findMany` using {@link listInclude}.
 * @returns Serializable list item for the processed-URLs table.
 */
export const mapRowToListItem = (row: ListRow) => ({
  id: row.id,
  tickerSymbol: row.ticker?.symbol ?? "—",
  agent:
    row.agent === "data_collection" ? "data-collection" : "page-collection",
  url: row.url,
  status: row.status,
  gateStatus: row.status === "collected" ? "passed" : "failed",
  reason: row.reason ?? null,
  reasonDetail: row.reasonDetail ?? null,
  source: row.source ?? null,
  curatedSourceId: row.curatedSourceId,
  curatedSourceName: row.curatedSource?.name ?? null,
  curatedSourceListingUrl: row.curatedSource?.listingUrl ?? null,
  createdAt: row.createdAt.toISOString(),
});

/** JSON list item type; derived from {@link mapRowToListItem}. */
export type ListItem = ReturnType<typeof mapRowToListItem>;
