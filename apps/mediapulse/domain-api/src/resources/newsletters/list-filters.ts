import { Prisma } from "@mediapulse/database";

/**
 * Input filters parsed from query string for the newsletter list endpoint.
 * All fields are optional; missing values mean "no filter".
 */
export type NewsletterListFilters = {
  /** Case-insensitive subject substring search. */
  q?: string;
  /** UUID; restricts results to a single ticker. */
  tickerId?: string;
  /** ISO-8601 lower bound on `createdAt` (inclusive). */
  from?: Date;
  /** ISO-8601 upper bound on `createdAt` (inclusive). */
  to?: Date;
};

/** Sort direction accepted by the list endpoint. */
export type NewsletterListSortDir = "asc" | "desc";

/** Sortable fields exposed on the list endpoint. */
export type NewsletterListSortField = "createdAt" | "subject";

/**
 * Builds a Prisma `where` for the newsletter list query from parsed filters.
 *
 * @param filters - Parsed filter values from the request.
 * @returns A `Prisma.NewsletterWhereInput` (always returned, possibly empty).
 */
export function buildNewsletterListWhere(
  filters: NewsletterListFilters,
): Prisma.NewsletterWhereInput {
  const parts: Prisma.NewsletterWhereInput[] = [];

  if (filters.q && filters.q.trim().length > 0) {
    parts.push({
      subject: { contains: filters.q.trim(), mode: "insensitive" },
    });
  }

  if (filters.tickerId) {
    parts.push({ tickerId: filters.tickerId });
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
}

/**
 * Builds the Prisma `orderBy` for the newsletter list, defaulting to
 * `createdAt DESC` per the PRD.
 *
 * @param sortBy - Field to sort by (defaults to `createdAt`).
 * @param sortDir - Direction (defaults to `desc`).
 * @returns A `Prisma.NewsletterOrderByWithRelationInput`.
 */
export function buildNewsletterListOrderBy(
  sortBy: NewsletterListSortField | undefined,
  sortDir: NewsletterListSortDir | undefined,
): Prisma.NewsletterOrderByWithRelationInput {
  const dir: Prisma.SortOrder = sortDir === "asc" ? "asc" : "desc";
  if (sortBy === "subject") return { subject: dir };
  return { createdAt: dir };
}
