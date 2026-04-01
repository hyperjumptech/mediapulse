import type { Prisma } from "@mediapulse/database";

/**
 * Maps Hermes table-v1 `sortBy` query values to Prisma `orderBy` for search-query list rows.
 *
 * @param sortBy - Column key from the dashboard manifest (`sortableFields`).
 * @param sortDir - Ascending or descending.
 * @returns Prisma order-by clause; defaults to newest `createdAt` first.
 */
export const resolveSearchQueryListOrderBy = (
  sortBy: string | undefined,
  sortDir: Prisma.SortOrder,
):
  | Prisma.SearchQueryOrderByWithRelationInput
  | Prisma.SearchQueryOrderByWithRelationInput[] => {
  switch (sortBy) {
    case "updatedAt":
      return { updatedAt: sortDir };
    case "setGeneratedAt":
      return { querySet: { generatedAt: sortDir } };
    case "rank":
      return { rank: sortDir };
    case "activeSet":
      return { querySet: { isActive: sortDir } };
    case "tickerSymbol":
      return { ticker: { symbol: sortDir } };
    case "tickerName":
      return { ticker: { name: sortDir } };
    case "text":
      return { text: sortDir };
    case "intent":
      return { intent: sortDir };
    case "source":
      return { source: sortDir };
    case "querySetId":
      return { querySet: { id: sortDir } };
    case "agentJobId":
      return { querySet: { agentJobId: sortDir } };
    case "generationPipeline":
      return { querySet: { generationSource: sortDir } };
    case "createdAt":
      return { createdAt: sortDir };
    default:
      return { createdAt: "desc" };
  }
};
