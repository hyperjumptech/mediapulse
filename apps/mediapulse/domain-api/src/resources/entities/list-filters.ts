import { Prisma } from "@mediapulse/database";

/**
 * Input filters parsed from query string for the entity list endpoint.
 * All fields are optional; missing values mean "no filter".
 */
export type EntityListFilters = {
  /** Case-insensitive substring search on name, description, and type name. */
  q?: string;
  /** UUID; restricts results to entities linked to a ticker via `TickerEntity`. */
  tickerId?: string;
  /** UUID; restricts results to a single entity type. */
  typeId?: string;
  /** Lower bound on `createdAt` (inclusive). */
  from?: Date;
  /** Upper bound on `createdAt` (inclusive). */
  to?: Date;
};

/**
 * Builds a Prisma `where` for the entity list query from parsed filters.
 *
 * @param filters - Parsed filter values from the request.
 * @returns A `Prisma.EntityWhereInput` (always returned, possibly empty).
 */
export const buildEntityListWhere = (
  filters: EntityListFilters,
): Prisma.EntityWhereInput => {
  const parts: Prisma.EntityWhereInput[] = [];

  if (filters.q && filters.q.trim().length > 0) {
    const query = filters.q.trim();
    parts.push({
      OR: [
        { canonicalName: { contains: query, mode: "insensitive" } },
        { description: { contains: query, mode: "insensitive" } },
        { type: { name: { contains: query, mode: "insensitive" } } },
      ],
    });
  }

  if (filters.tickerId) {
    parts.push({
      tickerEntities: { some: { tickerId: filters.tickerId } },
    });
  }

  if (filters.typeId) {
    parts.push({ typeId: filters.typeId });
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
