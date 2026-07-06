/**
 * Prisma `include` for data-source list rows and mappers to list items.
 */

import type { Prisma } from "@mediapulse/database";
import {
  classifyCollectionSource,
  COLLECTION_SOURCE_LABEL,
} from "./collection-source";
import { formatCollectionGateStatusLabel } from "./collection-gate-status";

/** Max characters of `content` included in list rows (full body is only on GET by id). */
export const DATA_SOURCE_CONTENT_PREVIEW_MAX = 200;

/**
 * `include` passed to `dataSource.findMany` for list views.
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
    },
  },
  curatedSource: {
    select: {
      id: true,
      name: true,
      listingUrl: true,
    },
  },
  articleRelevances: {
    orderBy: { score: "desc" as const },
    select: {
      id: true,
      score: true,
      associationReasoning: true,
      ticker: {
        select: {
          id: true,
          symbol: true,
          name: true,
        },
      },
    },
  },
} satisfies Prisma.DataSourceInclude;

/**
 * Prisma row shape for `dataSource.findMany` when loading the list view.
 */
export type ListRow = Prisma.DataSourceGetPayload<{
  include: typeof listInclude;
}>;

type ArticleRelevanceListRow = ListRow["articleRelevances"][number];

/**
 * Maps one article-relevance row to a Hermes linked-ticker item.
 *
 * @param row - Relevance row with joined ticker from {@link listInclude}.
 * @returns Serializable linked-ticker row.
 */
export const mapArticleRelevanceRow = (row: ArticleRelevanceListRow) => ({
  id: row.id,
  tickerId: row.ticker.id,
  tickerSymbol: row.ticker.symbol,
  tickerName: row.ticker.name,
  score: row.score,
  associationReasoning: row.associationReasoning ?? "",
});

/** JSON linked-ticker row type; derived from {@link mapArticleRelevanceRow}. */
export type ArticleRelevanceItem = ReturnType<typeof mapArticleRelevanceRow>;

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
 * Maps a data-source row (with relations) to the JSON list item.
 *
 * @param row - Row from `prisma.dataSource.findMany` using {@link listInclude}.
 * @returns Serializable list row for the domain API.
 */
export const mapRowToListItem = (row: ListRow) => {
  const collectionSource = classifyCollectionSource(row.searchQuery !== null);

  return {
    id: row.id,
    url: row.url,
    title: row.title,
    tickerSymbol: row.ticker?.symbol ?? "",
    tickerName: row.ticker?.name ?? "",
    searchQueryText: row.searchQuery?.text ?? "",
    collectionSource,
    collectionSourceLabel: COLLECTION_SOURCE_LABEL[collectionSource],
    collectionGateStatus: row.collectionGateStatus,
    collectionGateStatusLabel: formatCollectionGateStatusLabel(
      row.collectionGateStatus,
    ),
    collectionGateReason: row.collectionGateReason,
    curatedSource: row.curatedSource
      ? {
          id: row.curatedSource.id,
          name: row.curatedSource.name,
          listingUrl: row.curatedSource.listingUrl,
        }
      : null,
    articleRelevances: row.articleRelevances.map(mapArticleRelevanceRow),
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
