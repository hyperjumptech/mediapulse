import type {
  QueryAnalysisIntent,
  QueryAnalysisSource,
} from "@workspace/agent-data-api-contract";
import { Prisma } from "@mediapulse/database";

/**
 * Input filters parsed from query string for the search-query list endpoint.
 * All fields are optional; missing values mean "no filter".
 */
export type SearchQueryListFilters = {
  /** Case-insensitive substring search across query text, ticker, set id, and agent job id. */
  q?: string;
  /** UUID; restricts results to a single ticker. */
  tickerId?: string;
  /** Search-query intent enum value. */
  intent?: QueryAnalysisIntent;
  /** Search-query source enum value. */
  source?: QueryAnalysisSource;
  /** When true, only queries in an active set; when false, no set or inactive set. */
  isActive?: boolean;
  /** Lower bound on `createdAt` (inclusive). */
  from?: Date;
  /** Upper bound on `createdAt` (inclusive). */
  to?: Date;
};

/**
 * Builds a Prisma `where` for the search-query list query from parsed filters.
 *
 * @param filters - Parsed filter values from the request.
 * @returns A `Prisma.SearchQueryWhereInput` (always returned, possibly empty).
 */
export const buildSearchQueryListWhere = (
  filters: SearchQueryListFilters,
): Prisma.SearchQueryWhereInput => {
  const parts: Prisma.SearchQueryWhereInput[] = [];

  if (filters.q && filters.q.trim().length > 0) {
    const query = filters.q.trim();
    parts.push({
      OR: [
        { text: { contains: query, mode: "insensitive" } },
        { ticker: { name: { contains: query, mode: "insensitive" } } },
        { ticker: { symbol: { contains: query, mode: "insensitive" } } },
        {
          set: {
            is: { id: { contains: query, mode: "insensitive" } },
          },
        },
        {
          set: {
            is: {
              agentJobId: { contains: query, mode: "insensitive" },
            },
          },
        },
      ],
    });
  }

  if (filters.tickerId) {
    parts.push({ tickerId: filters.tickerId });
  }

  if (filters.intent) {
    parts.push({ intent: filters.intent });
  }

  if (filters.source) {
    parts.push({ source: filters.source });
  }

  if (filters.isActive === true) {
    parts.push({ set: { isActive: true } });
  } else if (filters.isActive === false) {
    parts.push({
      OR: [{ set: null }, { set: { isActive: false } }],
    });
  }

  const createdAt: { gte?: Date; lte?: Date } = {};
  if (filters.from && !Number.isNaN(filters.from.getTime())) {
    createdAt.gte = filters.from;
  }
  if (filters.to && !Number.isNaN(filters.to.getTime())) {
    createdAt.lte = filters.to;
  }
  if (createdAt.gte !== undefined || createdAt.lte !== undefined) {
    parts.push({ createdAt });
  }

  if (parts.length === 0) return {};
  if (parts.length === 1) return parts[0] ?? {};
  return { AND: parts };
};
