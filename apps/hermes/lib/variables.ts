import { prisma } from "@workspace/database";

type Db = typeof prisma;

/** Mask shown in UI for secret variable values (never expose real value). */
export const SECRET_MASK = "••••••••";

export type VariableRow = {
  id: string;
  key: string;
  value: string;
  note: string | null;
  isSecret: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type VariablesPageResult = {
  variables: VariableRow[];
  total: number;
  page: number;
  pageSize: number;
};

/**
 * Builds a Prisma where clause for variable search by key (partial, case-insensitive).
 *
 * @param search - Raw search string; trimmed and ignored if empty.
 * @returns Where clause object or undefined if no search.
 */
const variableSearchWhere = (
  search: string | undefined,
): { key: { contains: string; mode: "insensitive" } } | undefined => {
  const term = search?.trim();
  if (!term) return undefined;
  return { key: { contains: term, mode: "insensitive" } };
};

export type VariableSortField = "key" | "created";
export type VariableSortDir = "asc" | "desc";

const SORT_DEFAULT: { sortBy: VariableSortField; sortDir: VariableSortDir } = {
  sortBy: "key",
  sortDir: "asc",
};

/**
 * Builds Prisma orderBy from sort field and direction. "created" maps to createdAt.
 *
 * @param sortBy - Field to sort by (key or created).
 * @param sortDir - asc or desc.
 * @returns Prisma orderBy object.
 */
const variableOrderBy = (
  sortBy: VariableSortField,
  sortDir: VariableSortDir,
): { key?: "asc" | "desc"; createdAt?: "asc" | "desc" } => {
  const dir = sortDir === "asc" ? "asc" : "desc";
  if (sortBy === "created") return { createdAt: dir };
  return { key: dir };
};

/**
 * Masks variable value for API/UI when isSecret is true; returns value otherwise.
 *
 * @param value - Raw value from DB.
 * @param isSecret - Whether the variable is marked secret.
 * @returns Value or SECRET_MASK.
 */
export const maskValueIfSecret = (value: string, isSecret: boolean): string =>
  isSecret ? SECRET_MASK : value;

/**
 * Fetches a paginated list of variables with optional sort and search.
 * Secret variables have value replaced by SECRET_MASK so the real value is never returned.
 *
 * @param page - 1-based page number.
 * @param pageSize - Number of items per page.
 * @param options - Optional search term and sort (sortBy: key | created, sortDir: asc | desc).
 * @param db - Prisma client (injectable for tests).
 * @returns Variables for the page plus total count and pagination info.
 */
export const getVariablesPage = async (
  page: number,
  pageSize: number,
  options?: {
    search?: string;
    sortBy?: VariableSortField;
    sortDir?: VariableSortDir;
  },
  db: Db = prisma,
): Promise<VariablesPageResult> => {
  const skip = (page - 1) * pageSize;
  const keyWhere = variableSearchWhere(options?.search);
  const sortBy = options?.sortBy ?? SORT_DEFAULT.sortBy;
  const sortDir = options?.sortDir ?? SORT_DEFAULT.sortDir;
  const orderBy = variableOrderBy(sortBy, sortDir);
  const where = keyWhere ?? undefined;

  const [rows, total] = await Promise.all([
    db.variable.findMany({
      where,
      skip,
      take: pageSize,
      orderBy,
    }),
    db.variable.count({ where }),
  ]);

  const variables: VariableRow[] = rows.map((r) => ({
    id: r.id,
    key: r.key,
    value: maskValueIfSecret(r.value, r.isSecret),
    note: r.note,
    isSecret: r.isSecret,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }));

  return { variables, total, page, pageSize };
};

/**
 * Fetches a single variable by id for edit. When isSecret is true, value is not returned (use SECRET_MASK for display).
 *
 * @param id - UUID of the variable.
 * @param db - Prisma client (injectable for tests).
 * @returns The variable with value masked if secret, or null if not found.
 */
export const getVariableById = async (
  id: string,
  db: Db = prisma,
): Promise<VariableRow | null> => {
  const row = await db.variable.findUnique({
    where: { id },
  });
  if (!row) return null;
  return {
    id: row.id,
    key: row.key,
    value: maskValueIfSecret(row.value, row.isSecret),
    note: row.note,
    isSecret: row.isSecret,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
};
