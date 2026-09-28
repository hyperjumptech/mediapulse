import type { Prisma } from "@mediapulse/database";

export const listInclude = {
  ticker: {
    select: {
      symbol: true,
      name: true,
    },
  },
  set: {
    select: {
      id: true,
      isActive: true,
      generatedAt: true,
      generationSource: true,
      agentJobId: true,
    },
  },
} satisfies Prisma.SearchQueryInclude;

export type ListRow = Prisma.SearchQueryGetPayload<{
  include: typeof listInclude;
}>;

export const mapRowToListItem = (row: ListRow) => ({
  id: row.id,
  text: row.text,
  tickerSymbol: row.ticker.symbol,
  tickerName: row.ticker.name,
  activeSet: row.set?.isActive ? "Yes" : "No",
  intent: row.intent,
  rank: row.rank,
  setGeneratedAt: (row.set?.generatedAt ?? row.createdAt).toISOString(),
  generationPipeline: row.set?.generationSource ?? "",
  querySetId: row.set?.id ?? "",
  agentJobId: row.set?.agentJobId ?? "",
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

export type ListItem = ReturnType<typeof mapRowToListItem>;
