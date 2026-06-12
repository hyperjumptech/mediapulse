import { Prisma } from "@mediapulse/database";
import {
  buildCollectionSourceSearchQueryWhere,
  type CollectionSource,
} from "./collection-source";

/**
 * Input filters parsed from query string for the data-source list endpoint.
 * All fields are optional; missing values mean "no filter".
 */
export type DataSourceListFilters = {
  /** Case-insensitive substring search across title, url, content, ticker, and search query. */
  q?: string;
  /** UUID; restricts results to a single ticker. */
  tickerId?: string;
  /** Collection source bucket (page-collection or data-collection). */
  collectionSource?: CollectionSource;
  /** Lower bound on `createdAt` (inclusive). */
  from?: Date;
  /** Upper bound on `createdAt` (inclusive). */
  to?: Date;
};

/**
 * Builds a Prisma `where` for the data-source list query from parsed filters.
 *
 * @param filters - Parsed filter values from the request.
 * @returns A `Prisma.DataSourceWhereInput` (always returned, possibly empty).
 */
export const buildDataSourceListWhere = (
  filters: DataSourceListFilters,
): Prisma.DataSourceWhereInput => {
  const parts: Prisma.DataSourceWhereInput[] = [];

  if (filters.q && filters.q.trim().length > 0) {
    const query = filters.q.trim();
    parts.push({
      OR: [
        { title: { contains: query, mode: "insensitive" } },
        { url: { contains: query, mode: "insensitive" } },
        { content: { contains: query, mode: "insensitive" } },
        {
          ticker: {
            symbol: { contains: query, mode: "insensitive" },
          },
        },
        {
          ticker: { name: { contains: query, mode: "insensitive" } },
        },
        {
          searchQuery: {
            text: { contains: query, mode: "insensitive" },
          },
        },
      ],
    });
  }

  if (filters.tickerId) {
    parts.push({ tickerId: filters.tickerId });
  }

  if (filters.collectionSource) {
    parts.push({
      searchQuery: buildCollectionSourceSearchQueryWhere(
        filters.collectionSource,
      ),
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
