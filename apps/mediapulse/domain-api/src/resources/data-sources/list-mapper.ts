/**
 * Prisma `include` for data-source list/detail rows and mappers to list items and detail payloads.
 */

import type { Prisma } from "@mediapulse/database";
import {
  classifyCollectionSource,
  COLLECTION_SOURCE_LABEL,
} from "./collection-source";

/** Max characters of `content` included in list rows (full body is only on GET by id). */
export const DATA_SOURCE_CONTENT_PREVIEW_MAX = 200;

/**
 * `include` passed to `dataSource.findMany` / `findUnique` for list and detail views.
 */
export const listInclude = {
  ticker: {
    select: {
      symbol: true,
      name: true,
    },
  },
  searchQuery: {
    select: {
      id: true,
      text: true,
      source: true,
    },
  },
} satisfies Prisma.DataSourceInclude;

/**
 * Prisma row shape for `dataSource.findMany` when loading the list view.
 */
export type ListRow = Prisma.DataSourceGetPayload<{
  include: typeof listInclude;
}>;

/**
 * Truncates plain text for a list preview (ellipsis when longer than max).
 *
 * @param content - Raw `DataSource.content` string.
 * @param max - Maximum characters before truncation.
 * @returns Preview string safe for table cells.
 */
export const truncateContentPreview = (
  content: string,
  max: number,
): string => {
  if (content.length <= max) {
    return content;
  }
  return `${content.slice(0, max)}…`;
};

/**
 * Maps a data-source row (with ticker and search query) to the JSON list item.
 *
 * @param row - Row from `prisma.dataSource.findMany` using {@link listInclude}.
 * @returns Serializable list row for the domain API.
 */
export const mapRowToListItem = (row: ListRow) => {
  const collectionSource = classifyCollectionSource(row.searchQuery.source);

  return {
    id: row.id,
    url: row.url,
    title: row.title,
    tickerSymbol: row.ticker.symbol,
    tickerName: row.ticker.name,
    searchQueryText: row.searchQuery.text,
    collectionSource,
    collectionSourceLabel: COLLECTION_SOURCE_LABEL[collectionSource],
    contentPreview: truncateContentPreview(
      row.content,
      DATA_SOURCE_CONTENT_PREVIEW_MAX,
    ),
    contentLength: row.content.length,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
};

/** JSON list item type; derived from {@link mapRowToListItem}. */
export type ListItem = ReturnType<typeof mapRowToListItem>;

/**
 * Maps a data-source row to the JSON detail payload (GET by id), including full `content`.
 *
 * @param row - Row from `prisma.dataSource.findUnique` using {@link listInclude}.
 * @returns Serializable detail record for the Hermes read-only detail page.
 */
export const mapRowToDetailItem = (row: ListRow) => {
  const collectionSource = classifyCollectionSource(row.searchQuery.source);

  return {
    id: row.id,
    url: row.url,
    title: row.title,
    content: row.content,
    metadata: row.metadata,
    tickerId: row.tickerId,
    searchQueryId: row.searchQueryId,
    tickerSymbol: row.ticker.symbol,
    tickerName: row.ticker.name,
    searchQueryText: row.searchQuery.text,
    collectionSource,
    collectionSourceLabel: COLLECTION_SOURCE_LABEL[collectionSource],
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
};

/** JSON detail item type; derived from {@link mapRowToDetailItem}. */
export type DetailItem = ReturnType<typeof mapRowToDetailItem>;
