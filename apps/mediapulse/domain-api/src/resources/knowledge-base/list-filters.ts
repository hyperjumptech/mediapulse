import type { Prisma } from "@mediapulse/database";

const SORTABLE = ["symbol", "name", "entityCount", "lastSeenAt"] as const;

export type KnowledgeBaseSortBy = (typeof SORTABLE)[number];

/**
 * Narrows a sort field to one this resource can order by.
 *
 * @param value - Raw query value.
 * @returns The field, or "symbol" when the value names none.
 */
export const parseKnowledgeBaseSortBy = (
  value: string | undefined,
): KnowledgeBaseSortBy => SORTABLE.find((field) => field === value) ?? "symbol";

/**
 * Builds the where clause for the knowledge-base list.
 *
 * Only tickers holding an entity are listed: a ticker with an empty knowledge base has nothing to
 * open.
 *
 * @param input - Free-text search.
 */
export const buildKnowledgeBaseListWhere = (input: {
  q?: string;
}): Prisma.TickerWhereInput => {
  const q = input.q?.trim();
  const where: Prisma.TickerWhereInput = {
    knowledgeTickerEntities: { some: {} },
  };
  if (q !== undefined && q.length > 0) {
    where.OR = [
      { symbol: { contains: q, mode: "insensitive" } },
      { name: { contains: q, mode: "insensitive" } },
    ];
  }

  return where;
};

/**
 * Builds the order-by clause for the knowledge-base list.
 *
 * @param sortBy - Field to order on.
 * @param sortDir - Direction.
 */
export const buildKnowledgeBaseListOrderBy = (
  sortBy: KnowledgeBaseSortBy,
  sortDir: "asc" | "desc",
): Prisma.TickerOrderByWithRelationInput => {
  if (sortBy === "entityCount") {
    return { knowledgeTickerEntities: { _count: sortDir } };
  }
  if (sortBy === "lastSeenAt") {
    return { updatedAt: sortDir };
  }

  return sortBy === "name" ? { name: sortDir } : { symbol: sortDir };
};
