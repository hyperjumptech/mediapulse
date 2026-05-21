/**
 * Detail payload mapper for search-query-set read and edit forms.
 */

import type { Prisma } from "@mediapulse/database";

export const detailInclude = {
  ticker: {
    select: {
      id: true,
      symbol: true,
      name: true,
    },
  },
  searchQueries: {
    orderBy: [{ rank: "asc" as const }, { createdAt: "asc" as const }],
  },
} satisfies Prisma.SearchQuerySetInclude;

export type DetailRow = Prisma.SearchQuerySetGetPayload<{
  include: typeof detailInclude;
}>;

/**
 * Maps a search-query-set row to the Hermes detail / edit payload.
 *
 * @param row - Row from `searchQuerySet.findUnique` using {@link detailInclude}.
 * @returns Detail JSON including textarea-friendly JSON strings.
 */
export const mapRowToDetailItem = (row: DetailRow) => {
  const queries = row.searchQueries.map((query) => ({
    id: query.id,
    text: query.text,
    source: query.source,
    intent: query.intent,
    rank: query.rank,
  }));

  return {
    id: row.id,
    tickerId: row.tickerId,
    tickerSymbol: row.ticker.symbol,
    tickerName: row.ticker.name,
    isActive: row.isActive ? "Yes" : "No",
    generatedAt: row.generatedAt.toISOString(),
    generationSource: row.generationSource,
    agentJobId: row.agentJobId ?? "",
    strategySnapshotMarkdown: JSON.stringify(row.strategySnapshot, null, 2),
    strategySnapshotJson: JSON.stringify(row.strategySnapshot),
    queries,
    queriesJson: JSON.stringify(
      queries.map(({ text, source, intent, rank }) => ({
        text,
        source,
        intent,
        rank,
      })),
      null,
      2,
    ),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
};

/** Detail payload type derived from {@link mapRowToDetailItem}. */
export type DetailItem = ReturnType<typeof mapRowToDetailItem>;
