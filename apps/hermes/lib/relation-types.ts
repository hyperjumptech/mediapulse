import { prisma } from "@workspace/database";

type Db = typeof prisma;

export type RelationTypesPageResult = {
  relationTypes: Awaited<ReturnType<Db["relationType"]["findMany"]>>;
  total: number;
  page: number;
  pageSize: number;
};

/**
 * Builds a Prisma where clause for relation type search by name (partial, case-insensitive).
 *
 * @param search - Raw search string; trimmed and ignored if empty.
 * @returns Where clause object or undefined if no search.
 */
const relationTypeSearchWhere = (
  search: string | undefined,
): { name: { contains: string; mode: "insensitive" } } | undefined => {
  const term = search?.trim();
  if (!term) return undefined;
  return { name: { contains: term, mode: "insensitive" } };
};

export type RelationTypeSortField = "name" | "created";
export type RelationTypeSortDir = "asc" | "desc";

const SORT_DEFAULT: {
  sortBy: RelationTypeSortField;
  sortDir: RelationTypeSortDir;
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
const relationTypeOrderBy = (
  sortBy: RelationTypeSortField,
  sortDir: RelationTypeSortDir,
): { name?: "asc" | "desc"; createdAt?: "asc" | "desc" } => {
  const dir = sortDir === "asc" ? "asc" : "desc";
  if (sortBy === "created") return { createdAt: dir };
  return { name: dir };
};

/**
 * Fetches a paginated list of relation types with optional sort and search.
 *
 * @param page - 1-based page number.
 * @param pageSize - Number of items per page.
 * @param options - Optional search term and sort (sortBy: name | created, sortDir: asc | desc).
 * @param db - Prisma client (injectable for tests).
 * @returns Relation types for the page plus total count and pagination info.
 */
export const getRelationTypesPage = async (
  page: number,
  pageSize: number,
  options?: {
    search?: string;
    sortBy?: RelationTypeSortField;
    sortDir?: RelationTypeSortDir;
  },
  db: Db = prisma,
): Promise<RelationTypesPageResult> => {
  const skip = (page - 1) * pageSize;
  const where = relationTypeSearchWhere(options?.search);
  const sortBy = options?.sortBy ?? SORT_DEFAULT.sortBy;
  const sortDir = options?.sortDir ?? SORT_DEFAULT.sortDir;
  const orderBy = relationTypeOrderBy(sortBy, sortDir);

  const [relationTypes, total] = await Promise.all([
    db.relationType.findMany({
      where,
      skip,
      take: pageSize,
      orderBy,
    }),
    db.relationType.count({ where }),
  ]);
  return { relationTypes, total, page, pageSize };
};

/**
 * Fetches a single relation type by id, or null if not found.
 *
 * @param relationTypeId - UUID of the relation type.
 * @param db - Prisma client (injectable for tests).
 * @returns The relation type or null.
 */
export const getRelationTypeById = async (
  relationTypeId: string,
  db: Db = prisma,
): Promise<Awaited<ReturnType<Db["relationType"]["findUnique"]>>> => {
  return db.relationType.findUnique({
    where: { id: relationTypeId },
  });
};
