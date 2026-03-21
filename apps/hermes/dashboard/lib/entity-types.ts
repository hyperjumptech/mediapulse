import { prisma } from "@mediapulse/database";

type Db = typeof prisma;

export type EntityTypesPageResult = {
  entityTypes: Awaited<ReturnType<Db["entityType"]["findMany"]>>;
  total: number;
  page: number;
  pageSize: number;
};

/**
 * Builds a Prisma where clause for entity type search by name (partial, case-insensitive).
 *
 * @param search - Raw search string; trimmed and ignored if empty.
 * @returns Where clause object or undefined if no search.
 */
const entityTypeSearchWhere = (
  search: string | undefined,
): { name: { contains: string; mode: "insensitive" } } | undefined => {
  const term = search?.trim();
  if (!term) return undefined;
  return { name: { contains: term, mode: "insensitive" } };
};

export type EntityTypeSortField = "name" | "created";
export type EntityTypeSortDir = "asc" | "desc";

const SORT_DEFAULT: {
  sortBy: EntityTypeSortField;
  sortDir: EntityTypeSortDir;
} = {
  sortBy: "name",
  sortDir: "asc",
};

/**
 * Builds Prisma orderBy from sort field and direction. "created" maps to createdAt.
 *
 * @param sortBy - Field to sort by (name or created).
 * @param sortDir - asc or desc.
 * @returns Prisma orderBy object.
 */
const entityTypeOrderBy = (
  sortBy: EntityTypeSortField,
  sortDir: EntityTypeSortDir,
): { name?: "asc" | "desc"; createdAt?: "asc" | "desc" } => {
  const dir = sortDir === "asc" ? "asc" : "desc";
  if (sortBy === "created") return { createdAt: dir };
  return { name: dir };
};

/**
 * Fetches a paginated list of entity types with optional sort and search.
 *
 * @param page - 1-based page number.
 * @param pageSize - Number of items per page.
 * @param options - Optional search term and sort (sortBy: name | created, sortDir: asc | desc).
 * @param db - Prisma client (injectable for tests).
 * @returns Entity types for the page plus total count and pagination info.
 */
export const getEntityTypesPage = async (
  page: number,
  pageSize: number,
  options?: {
    search?: string;
    sortBy?: EntityTypeSortField;
    sortDir?: EntityTypeSortDir;
  },
  db: Db = prisma,
): Promise<EntityTypesPageResult> => {
  const skip = (page - 1) * pageSize;
  const where = entityTypeSearchWhere(options?.search);
  const sortBy = options?.sortBy ?? SORT_DEFAULT.sortBy;
  const sortDir = options?.sortDir ?? SORT_DEFAULT.sortDir;
  const orderBy = entityTypeOrderBy(sortBy, sortDir);

  const [entityTypes, total] = await Promise.all([
    db.entityType.findMany({
      where,
      skip,
      take: pageSize,
      orderBy,
    }),
    db.entityType.count({ where }),
  ]);
  return { entityTypes, total, page, pageSize };
};

/**
 * Fetches a single entity type by id, or null if not found.
 *
 * @param entityTypeId - UUID of the entity type.
 * @param db - Prisma client (injectable for tests).
 * @returns The entity type or null.
 */
export const getEntityTypeById = async (
  entityTypeId: string,
  db: Db = prisma,
): Promise<Awaited<ReturnType<Db["entityType"]["findUnique"]>>> => {
  return db.entityType.findUnique({
    where: { id: entityTypeId },
  });
};
