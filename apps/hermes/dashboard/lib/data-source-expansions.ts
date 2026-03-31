import { z } from "zod";
import {
  createDomainTableItem,
  deleteDomainTableItem,
  getDomainTableList,
  updateDomainTableItem,
} from "./domain-dashboard";

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

export type DataSourceExpansionSortField = "name" | "created";
export type DataSourceExpansionSortDir = "asc" | "desc";

const SORT_DEFAULT: {
  sortBy: DataSourceExpansionSortField;
  sortDir: DataSourceExpansionSortDir;
} = {
  sortBy: "name",
  sortDir: "asc",
};

const dataSourceExpansionItemSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  expansionString: z.string().min(1),
  description: z.string().nullable().optional(),
  createdAt: z.union([z.string().datetime(), z.date()]),
  updatedAt: z.union([z.string().datetime(), z.date()]),
});
const dataSourceExpansionMutationResponseSchema = z.object({
  id: z.string().min(1),
});

type DataSourceExpansionDependencies = {
  getList?: typeof getDomainTableList;
  createItem?: typeof createDomainTableItem;
  updateItem?: typeof updateDomainTableItem;
  deleteItem?: typeof deleteDomainTableItem;
};

/**
 * Maps list sort options to domain API sort names.
 *
 * @param sortBy - UI sort field.
 * @returns Domain API sort field.
 */
const toDomainSortBy = (sortBy: DataSourceExpansionSortField): string => {
  return sortBy === "created" ? "createdAt" : "name";
};

/**
 * Parses a domain table row into a typed expansion row.
 *
 * @param value - Raw domain response item.
 * @returns Parsed expansion row.
 */
const parseExpansionItem = (
  value: Record<string, unknown>,
): DataSourceExpansionRow => {
  const parsed = dataSourceExpansionItemSchema.parse(value);
  return {
    id: parsed.id,
    name: parsed.name,
    expansionString: parsed.expansionString,
    description: parsed.description ?? null,
    createdAt:
      parsed.createdAt instanceof Date
        ? parsed.createdAt
        : new Date(parsed.createdAt),
    updatedAt:
      parsed.updatedAt instanceof Date
        ? parsed.updatedAt
        : new Date(parsed.updatedAt),
  };
};

/**
 * Fetches a paginated list of data source expansions with optional sort and search.
 *
 * @param integrationId - Domain integration id (e.g. from registration).
 * @param page - 1-based page number.
 * @param pageSize - Number of items per page.
 * @param options - Optional search term and sort (sortBy: name | created, sortDir: asc | desc).
 * @param dependencies - Optional injectable domain API collaborators.
 * @returns Expansions for the page plus total count and pagination info.
 */
export const getDataSourceExpansionsPage = async (
  integrationId: string,
  page: number,
  pageSize: number,
  options?: {
    search?: string;
    sortBy?: DataSourceExpansionSortField;
    sortDir?: DataSourceExpansionSortDir;
  },
  dependencies: DataSourceExpansionDependencies = {},
): Promise<DataSourceExpansionsPageResult> => {
  const sortBy = options?.sortBy ?? SORT_DEFAULT.sortBy;
  const sortDir = options?.sortDir ?? SORT_DEFAULT.sortDir;
  const getList = dependencies.getList ?? getDomainTableList;

  const response = await getList(integrationId, "data-source-expansions", {
    page,
    pageSize,
    query: options?.search,
    sortBy: toDomainSortBy(sortBy),
    sortDir,
  });

  const expansions = response.items.map((item) => parseExpansionItem(item));

  return {
    expansions,
    total: response.total,
    page: response.page,
    pageSize: response.pageSize,
  };
};

/**
 * Fetches a single data source expansion by id.
 *
 * @param integrationId - Domain integration id.
 * @param id - UUID of the expansion.
 * @param dependencies - Optional injectable domain API collaborators.
 * @returns The expansion or null if not found.
 */
export const getDataSourceExpansionById = async (
  integrationId: string,
  id: string,
  dependencies: DataSourceExpansionDependencies = {},
): Promise<DataSourceExpansionRow | null> => {
  const getList = dependencies.getList ?? getDomainTableList;
  let currentPage = 1;
  const pageSize = 100;

  while (true) {
    const response = await getList(integrationId, "data-source-expansions", {
      page: currentPage,
      pageSize,
      sortBy: "name",
      sortDir: "asc",
    });

    const matched = response.items
      .map((item) => parseExpansionItem(item))
      .find((item) => item.id === id);
    if (matched) return matched;

    if (currentPage * pageSize >= response.total) return null;
    currentPage += 1;
  }
};

/**
 * Creates a data source expansion.
 *
 * @param integrationId - Domain integration id.
 * @param data - Name, expansionString, optional description.
 * @param dependencies - Optional injectable domain API collaborators.
 * @returns The created expansion.
 */
export const createDataSourceExpansion = async (
  integrationId: string,
  data: {
    name: string;
    expansionString: string;
    description?: string | null;
    createdById: string;
  },
  dependencies: DataSourceExpansionDependencies = {},
): Promise<DataSourceExpansionRow> => {
  const createItem = dependencies.createItem ?? createDomainTableItem;
  const getList = dependencies.getList ?? getDomainTableList;
  const description =
    data.description != null && String(data.description).trim().length > 0
      ? String(data.description).trim()
      : null;

  const payload = {
    name: data.name.trim(),
    expansionString: data.expansionString.trim(),
    description,
  } satisfies Record<string, unknown>;
  const createdResponse = dataSourceExpansionMutationResponseSchema.parse(
    await createItem(integrationId, "data-source-expansions", payload),
  );
  const created = await getDataSourceExpansionById(
    integrationId,
    createdResponse.id,
    {
      getList,
    },
  );
  if (!created) {
    throw new Error("Created data source expansion could not be loaded");
  }

  return created;
};

/**
 * Updates a data source expansion by id.
 *
 * @param integrationId - Domain integration id.
 * @param id - UUID of the expansion.
 * @param data - Name, expansionString, optional description.
 * @param dependencies - Optional injectable domain API collaborators.
 * @returns The updated expansion or null if not found.
 */
export const updateDataSourceExpansion = async (
  integrationId: string,
  id: string,
  data: { name: string; expansionString: string; description?: string | null },
  dependencies: DataSourceExpansionDependencies = {},
): Promise<DataSourceExpansionRow | null> => {
  const updateItem = dependencies.updateItem ?? updateDomainTableItem;
  const getList = dependencies.getList ?? getDomainTableList;
  const description =
    data.description != null && String(data.description).trim().length > 0
      ? String(data.description).trim()
      : null;

  try {
    const updatedResponse = dataSourceExpansionMutationResponseSchema.parse(
      await updateItem(integrationId, "data-source-expansions", id, {
        name: data.name.trim(),
        expansionString: data.expansionString.trim(),
        description,
      }),
    );
    const updated = await getDataSourceExpansionById(
      integrationId,
      updatedResponse.id,
      {
        getList,
      },
    );
    if (!updated) {
      return null;
    }

    return updated;
  } catch {
    return null;
  }
};

/**
 * Deletes a data source expansion by id.
 *
 * @param integrationId - Domain integration id.
 * @param id - UUID of the expansion.
 * @param dependencies - Optional injectable domain API collaborators.
 * @returns True if deleted, false if not found.
 */
export const deleteDataSourceExpansion = async (
  integrationId: string,
  id: string,
  dependencies: DataSourceExpansionDependencies = {},
): Promise<boolean> => {
  const deleteItem = dependencies.deleteItem ?? deleteDomainTableItem;
  try {
    await deleteItem(integrationId, "data-source-expansions", id);
    return true;
  } catch {
    return false;
  }
};
