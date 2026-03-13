import type { Prisma } from "@workspace/database";
import { prisma } from "@workspace/database";

type Db = typeof prisma;

export type DataSourceExpansionRow = {
  id: string;
  name: string;
  expansionString: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type DataSourceExpansionsPageResult = {
  expansions: DataSourceExpansionRow[];
  total: number;
  page: number;
  pageSize: number;
};

/**
 * Builds a Prisma where clause for data source expansion search by name or description (partial, case-insensitive).
 *
 * @param search - Raw search string; trimmed and ignored if empty.
 * @returns Where clause object or undefined if no search.
 */
const expansionSearchWhere = (
  search: string | undefined,
):
  | {
      OR: Array<
        | { name: { contains: string; mode: "insensitive" } }
        | { description: { contains: string; mode: "insensitive" } }
      >;
    }
  | undefined => {
  const term = search?.trim();
  if (!term) return undefined;
  return {
    OR: [
      { name: { contains: term, mode: "insensitive" } },
      { description: { contains: term, mode: "insensitive" } },
    ],
  };
};

export type DataSourceExpansionSortField = "name" | "created";
export type DataSourceExpansionSortDir = "asc" | "desc";

const SORT_DEFAULT: {
  sortBy: DataSourceExpansionSortField;
  sortDir: DataSourceExpansionSortDir;
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
const expansionOrderBy = (
  sortBy: DataSourceExpansionSortField,
  sortDir: DataSourceExpansionSortDir,
): Prisma.DataSourceExpansionOrderByWithRelationInput => {
  const dir = sortDir === "asc" ? "asc" : "desc";
  if (sortBy === "created") return { createdAt: dir };
  return { name: dir };
};

/**
 * Fetches a paginated list of data source expansions with optional sort and search.
 *
 * @param page - 1-based page number.
 * @param pageSize - Number of items per page.
 * @param options - Optional search term and sort (sortBy: name | created, sortDir: asc | desc).
 * @param db - Prisma client (injectable for tests).
 * @returns Expansions for the page plus total count and pagination info.
 */
export const getDataSourceExpansionsPage = async (
  page: number,
  pageSize: number,
  options?: {
    search?: string;
    sortBy?: DataSourceExpansionSortField;
    sortDir?: DataSourceExpansionSortDir;
  },
  db: Db = prisma,
): Promise<DataSourceExpansionsPageResult> => {
  const skip = (page - 1) * pageSize;
  const where = expansionSearchWhere(options?.search);
  const sortBy = options?.sortBy ?? SORT_DEFAULT.sortBy;
  const sortDir = options?.sortDir ?? SORT_DEFAULT.sortDir;
  const orderBy = expansionOrderBy(sortBy, sortDir);

  const [rows, total] = await Promise.all([
    db.dataSourceExpansion.findMany({
      where,
      skip,
      take: pageSize,
      orderBy,
    }),
    db.dataSourceExpansion.count({ where }),
  ]);

  const expansions: DataSourceExpansionRow[] = rows.map((r) => ({
    id: r.id,
    name: r.name,
    expansionString: r.expansionString,
    description: r.description,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }));

  return { expansions, total, page, pageSize };
};

/**
 * Fetches a single data source expansion by id for edit.
 *
 * @param id - UUID of the expansion.
 * @param db - Prisma client (injectable for tests).
 * @returns The expansion or null if not found.
 */
export const getDataSourceExpansionById = async (
  id: string,
  db: Db = prisma,
): Promise<DataSourceExpansionRow | null> => {
  const row = await db.dataSourceExpansion.findUnique({
    where: { id },
  });
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    expansionString: row.expansionString,
    description: row.description,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
};

/**
 * Creates a data source expansion.
 *
 * @param data - Name, expansionString, optional description.
 * @param db - Prisma client (injectable for tests).
 * @returns The created expansion.
 */
export const createDataSourceExpansion = async (
  data: {
    name: string;
    expansionString: string;
    description?: string | null;
    createdById: string;
  },
  db: Db = prisma,
): Promise<DataSourceExpansionRow> => {
  const description =
    data.description != null && String(data.description).trim().length > 0
      ? String(data.description).trim()
      : null;

  const created = await db.dataSourceExpansion.create({
    data: {
      name: data.name.trim(),
      expansionString: data.expansionString.trim(),
      description,
      createdBy: { connect: { id: data.createdById } },
    },
  });

  return {
    id: created.id,
    name: created.name,
    expansionString: created.expansionString,
    description: created.description,
    createdAt: created.createdAt,
    updatedAt: created.updatedAt,
  };
};

/**
 * Updates a data source expansion by id.
 *
 * @param id - UUID of the expansion.
 * @param data - Name, expansionString, optional description.
 * @param db - Prisma client (injectable for tests).
 * @returns The updated expansion or null if not found.
 */
export const updateDataSourceExpansion = async (
  id: string,
  data: { name: string; expansionString: string; description?: string | null },
  db: Db = prisma,
): Promise<DataSourceExpansionRow | null> => {
  const description =
    data.description != null && String(data.description).trim().length > 0
      ? String(data.description).trim()
      : null;

  try {
    const updated = await db.dataSourceExpansion.update({
      where: { id },
      data: {
        name: data.name.trim(),
        expansionString: data.expansionString.trim(),
        description,
      },
    });
    return {
      id: updated.id,
      name: updated.name,
      expansionString: updated.expansionString,
      description: updated.description,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    };
  } catch {
    return null;
  }
};

/**
 * Deletes a data source expansion by id.
 *
 * @param id - UUID of the expansion.
 * @param db - Prisma client (injectable for tests).
 * @returns True if deleted, false if not found.
 */
export const deleteDataSourceExpansion = async (
  id: string,
  db: Db = prisma,
): Promise<boolean> => {
  const result = await db.dataSourceExpansion.deleteMany({
    where: { id },
  });
  return result.count > 0;
};
