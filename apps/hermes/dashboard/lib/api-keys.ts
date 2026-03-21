import { prisma } from "@workspace/database";

type Db = typeof prisma;

type ApiKeyWithUser = Awaited<ReturnType<Db["aPIKey"]["findMany"]>>[number] & {
  user: { id: string; name: string; email: string };
};

export type ApiKeysPageResult = {
  apiKeys: ApiKeyWithUser[];
  total: number;
  page: number;
  pageSize: number;
};

/**
 * Builds a Prisma where clause for API key search by name (partial, case-insensitive).
 *
 * @param search - Raw search string; trimmed and ignored if empty.
 * @returns Where clause object or undefined if no search.
 */
const apiKeySearchWhere = (
  search: string | undefined,
): { name: { contains: string; mode: "insensitive" } } | undefined => {
  const term = search?.trim();
  if (!term) return undefined;
  return { name: { contains: term, mode: "insensitive" } };
};

export type ApiKeySortField = "name" | "created";
export type ApiKeySortDir = "asc" | "desc";

const SORT_DEFAULT: { sortBy: ApiKeySortField; sortDir: ApiKeySortDir } = {
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
const apiKeyOrderBy = (
  sortBy: ApiKeySortField,
  sortDir: ApiKeySortDir,
): { name?: "asc" | "desc"; createdAt?: "asc" | "desc" } => {
  const dir = sortDir === "asc" ? "asc" : "desc";
  if (sortBy === "created") return { createdAt: dir };
  return { name: dir };
};

/**
 * Fetches a paginated list of API keys with optional sort and search.
 * Each row includes user (id, name, email) for display.
 *
 * @param page - 1-based page number.
 * @param pageSize - Number of items per page.
 * @param options - Optional search term and sort (sortBy: name | created, sortDir: asc | desc).
 * @param db - Prisma client (injectable for tests).
 * @returns API keys for the page plus total count and pagination info.
 */
export const getApiKeysPage = async (
  page: number,
  pageSize: number,
  options?: {
    search?: string;
    sortBy?: ApiKeySortField;
    sortDir?: ApiKeySortDir;
  },
  db: Db = prisma,
): Promise<ApiKeysPageResult> => {
  const skip = (page - 1) * pageSize;
  const nameWhere = apiKeySearchWhere(options?.search);
  const sortBy = options?.sortBy ?? SORT_DEFAULT.sortBy;
  const sortDir = options?.sortDir ?? SORT_DEFAULT.sortDir;
  const orderBy = apiKeyOrderBy(sortBy, sortDir);
  const where = nameWhere ?? undefined;

  const [apiKeys, total] = await Promise.all([
    db.aPIKey.findMany({
      where,
      skip,
      take: pageSize,
      orderBy,
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    }),
    db.aPIKey.count({ where }),
  ]);
  return { apiKeys, total, page, pageSize };
};
