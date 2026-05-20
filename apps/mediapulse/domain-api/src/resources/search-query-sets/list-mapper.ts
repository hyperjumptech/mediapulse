/**
 * Prisma include and mappers for search-query-set list rows.
 */

import type { Prisma } from "@mediapulse/database";

export const listInclude = {
  ticker: {
    select: {
      symbol: true,
      name: true,
    },
  },
  _count: {
    select: {
      searchQueries: true,
    },
  },
} satisfies Prisma.SearchQuerySetInclude;

export type ListRow = Prisma.SearchQuerySetGetPayload<{
  include: typeof listInclude;
}>;

/**
 * Maps a search-query-set row to the table-v1 list item shape.
 *
 * @param row - Row from `searchQuerySet.findMany` using {@link listInclude}.
 * @returns Serializable list item for the domain API.
 */
export const mapRowToListItem = (row: ListRow) => ({
  id: row.id,
  tickerSymbol: row.ticker.symbol,
  tickerName: row.ticker.name,
  isActive: row.isActive ? "Yes" : "No",
  generatedAt: row.generatedAt.toISOString(),
  generationSource: row.generationSource,
  queryCount: String(row._count.searchQueries),
  agentJobId: row.agentJobId ?? "",
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

/** JSON list item type derived from {@link mapRowToListItem}. */
export type ListItem = ReturnType<typeof mapRowToListItem>;
