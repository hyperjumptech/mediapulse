/**
 * Detail payload mapper for data-source read views (page-collection gate, curated source).
 */

import type { Prisma } from "@mediapulse/database";
import {
  classifyCollectionSource,
  COLLECTION_SOURCE_LABEL,
} from "./collection-source";
import { formatCollectionGateStatusLabel } from "./collection-gate-status";
import { listInclude, type ListRow } from "./list-mapper";

/**
 * `include` passed to `dataSource.findUnique` for Hermes detail pages.
 */
export const detailInclude = {
  ...listInclude,
} satisfies Prisma.DataSourceInclude;

/**
 * Prisma row shape for `dataSource.findUnique` when loading the detail view.
 */
export type DetailRow = Prisma.DataSourceGetPayload<{
  include: typeof detailInclude;
}>;

/**
 * Maps a data-source row to the JSON detail payload (GET by id), including full `content`.
 *
 * @param row - Row from `prisma.dataSource.findUnique` using {@link detailInclude}.
 * @returns Serializable detail record for the Hermes read-only detail page.
 */
export const mapRowToDetailItem = (row: DetailRow) => {
  const collectionSource = classifyCollectionSource(row.searchQuery !== null);

  return {
    id: row.id,
    url: row.url,
    title: row.title,
    content: row.content,
    metadata: row.metadata,
    tickerId: row.tickerId,
    searchQueryId: row.searchQueryId,
    curatedSourceId: row.curatedSource?.id ?? null,
    curatedSourceName: row.curatedSource?.name ?? "",
    curatedSourceListingUrl: row.curatedSource?.listingUrl ?? "",
    curatedSource: row.curatedSource
      ? {
          id: row.curatedSource.id,
          name: row.curatedSource.name,
          listingUrl: row.curatedSource.listingUrl,
        }
      : null,
    collectionGateStatus: row.collectionGateStatus,
    collectionGateStatusLabel: formatCollectionGateStatusLabel(
      row.collectionGateStatus,
    ),
    collectionGateReason: row.collectionGateReason ?? "",
    tickerSymbol: row.ticker?.symbol ?? "",
    tickerName: row.ticker?.name ?? "",
    searchQueryText: row.searchQuery?.text ?? "",
    collectionSource,
    collectionSourceLabel: COLLECTION_SOURCE_LABEL[collectionSource],
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
};

/** JSON detail item type; derived from {@link mapRowToDetailItem}. */
export type DetailItem = ReturnType<typeof mapRowToDetailItem>;

/** Re-export list row type for tests that build partial fixtures. */
export type { ListRow };
