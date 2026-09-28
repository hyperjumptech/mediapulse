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

export const mapRowToListItem = (row: ListRow) => ({
  id: row.id,
  tickerSymbol: row.ticker.symbol,
  tickerName: row.ticker.name,
  isActive: row.isActive,
  generatedAt: row.generatedAt.toISOString(),
  generationSource: row.generationSource,
  queryCount: row._count.searchQueries,
  agentJobId: row.agentJobId ?? "",
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

export type ListItem = ReturnType<typeof mapRowToListItem>;
