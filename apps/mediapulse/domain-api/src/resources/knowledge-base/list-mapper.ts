import type { Prisma } from "@mediapulse/database";

export const listInclude = {
  _count: {
    select: { knowledgeTickerEntities: true, knowledgeTickerRelations: true },
  },
  knowledgeTickerEntities: {
    select: { lastSeenAt: true },
    orderBy: { lastSeenAt: "desc" },
    take: 1,
  },
} satisfies Prisma.TickerInclude;

export type KnowledgeBaseListRow = Prisma.TickerGetPayload<{
  include: typeof listInclude;
}>;

export type ListItem = {
  id: string;
  symbol: string;
  name: string;
  entityCount: number;
  relationCount: number;
  articleCount: number;
  lastSeenAt: string | null;
};

/**
 * Shapes one ticker's knowledge base for the list.
 *
 * @param row - Ticker with its membership counts.
 * @param articleCount - Distinct articles mentioning any of its entities.
 */
export function mapRowToListItem(
  row: KnowledgeBaseListRow,
  articleCount: number,
): ListItem {
  const lastSeen = row.knowledgeTickerEntities[0]?.lastSeenAt ?? null;

  return {
    id: row.id,
    symbol: row.symbol,
    name: row.name,
    entityCount: row._count.knowledgeTickerEntities,
    relationCount: row._count.knowledgeTickerRelations,
    articleCount,
    lastSeenAt: lastSeen === null ? null : lastSeen.toISOString(),
  };
}
