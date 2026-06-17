import { Prisma } from "@mediapulse/database";

/**
 * Input filters parsed from query string for the curated-source list endpoint.
 * All fields are optional; missing values mean "no filter".
 */
export type CuratedSourceListFilters = {
  /** Case-insensitive substring search on name and listing URL. */
  q?: string;
  /** When set, restricts results to enabled or disabled sources. */
  enabled?: boolean;
  /** ISO-8601 lower bound on `createdAt` (inclusive). */
  from?: Date;
  /** ISO-8601 upper bound on `createdAt` (inclusive). */
  to?: Date;
};

/** Sort direction accepted by the list endpoint. */
export type CuratedSourceListSortDir = "asc" | "desc";

/** Sortable fields exposed on the list endpoint. */
export type CuratedSourceListSortField =
  | "name"
  | "listingUrl"
  | "linkType"
  | "enabled"
  | "maxItems"
  | "createdAt";

/**
 * Builds a Prisma `where` for the curated-source list query from parsed filters.
 *
 * @param filters - Parsed filter values from the request.
 * @returns A `Prisma.CuratedSourceWhereInput` (always returned, possibly empty).
 */
export const buildCuratedSourceListWhere = (
  filters: CuratedSourceListFilters,
): Prisma.CuratedSourceWhereInput => {
  const parts: Prisma.CuratedSourceWhereInput[] = [];

  if (filters.q && filters.q.trim().length > 0) {
    const query = filters.q.trim();
    parts.push({
      OR: [
        { name: { contains: query, mode: "insensitive" } },
        { listingUrl: { contains: query, mode: "insensitive" } },
      ],
    });
  }

  if (filters.enabled !== undefined) {
    parts.push({ enabled: filters.enabled });
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

/**
 * Builds the Prisma `orderBy` for the curated-source list.
 *
 * @param sortBy - Field to sort by (defaults to `createdAt`).
 * @param sortDir - Direction (defaults to `desc`).
 * @returns A `Prisma.CuratedSourceOrderByWithRelationInput`.
 */
export const buildCuratedSourceListOrderBy = (
  sortBy: CuratedSourceListSortField | undefined,
  sortDir: CuratedSourceListSortDir | undefined,
): Prisma.CuratedSourceOrderByWithRelationInput => {
  const dir: Prisma.SortOrder = sortDir === "asc" ? "asc" : "desc";

  switch (sortBy) {
    case "name":
      return { name: dir };
    case "listingUrl":
      return { listingUrl: dir };
    case "linkType":
      return { linkType: dir };
    case "enabled":
      return { enabled: dir };
    case "maxItems":
      return { maxItems: dir };
    case "createdAt":
      return { createdAt: dir };
    default:
      return { createdAt: "desc" };
  }
};
