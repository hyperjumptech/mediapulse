/**
 * CRUD for {@link DataSourceExpansionTemplate} rows in orchestration storage (scoped per domain integration).
 */

import { tableV1ListResponseSchema } from "@hermes/domain-contract";
import {
  prisma,
  type Prisma,
  type PrismaClient,
} from "@hermes/orchestration-database";

import { getDashboardSession } from "./auth-dashboard";
import { getDomainIntegrationByKey } from "./domain-integrations";
import {
  dataSourceExpansionTemplateCreateBodySchema,
  dataSourceExpansionTemplateUpdateBodySchema,
} from "./data-source-expansion-template-write-schemas";
import {
  getPipelinesUsingExpansionString,
  type PipelineUsageSummary,
} from "./pipeline-usage";

/** Orchestration delegate for {@link DataSourceExpansionTemplate} (injectable in tests). */
export type DataSourceExpansionTemplateDelegate =
  PrismaClient["dataSourceExpansionTemplate"];

/** Pagination and sort for template list (matches {@link domain-dashboard} list params). */
export type DataSourceExpansionTemplateListParams = {
  page: number;
  pageSize: number;
  query?: string;
  sortBy?: string;
  sortDir?: "asc" | "desc";
};

/** JSON list row shape for table-v1 (ISO date strings). */
export type DataSourceExpansionTemplateListItem = {
  id: string;
  name: string;
  expansionString: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
};

export { integrationSupportsHermesDataSourceExpansionTemplates } from "./data-source-expansion-template-capabilities";

/**
 * Maps a Prisma row to a table-v1 list item.
 *
 * @param row - Loaded template row.
 * @returns Serializable list item.
 */
export const mapDataSourceExpansionTemplateRowToListItem = (row: {
  id: string;
  name: string;
  expansionString: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
}): DataSourceExpansionTemplateListItem => ({
  id: row.id,
  name: row.name,
  expansionString: row.expansionString,
  description: row.description,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

const nullableText = (value: unknown): string | null => {
  if (value == null) return null;
  const s = String(value).trim();
  return s.length === 0 ? null : s;
};

export type ListDataSourceExpansionTemplatesDependencies = {
  db?: DataSourceExpansionTemplateDelegate;
  getIntegration?: typeof getDomainIntegrationByKey;
};

/**
 * Loads a paginated list of templates for the given integration key.
 *
 * @param integrationKey - Registered domain integration key.
 * @param params - Pagination, search, sort.
 * @param dependencies - Injectable DB and integration resolver.
 * @returns Parsed table-v1 list response.
 */
export const listDataSourceExpansionTemplatesForIntegration = async (
  integrationKey: string,
  params: DataSourceExpansionTemplateListParams,
  dependencies: ListDataSourceExpansionTemplatesDependencies = {},
): Promise<ReturnType<typeof tableV1ListResponseSchema.parse>> => {
  const db = dependencies.db ?? prisma.dataSourceExpansionTemplate;
  const getIntegration =
    dependencies.getIntegration ?? getDomainIntegrationByKey;

  const integration = await getIntegration(integrationKey);
  if (!integration) {
    throw new Error(
      `Domain integration "${integrationKey}" is not active or not registered`,
    );
  }

  const { page, pageSize } = params;
  const skip = (page - 1) * pageSize;
  const query = params.query?.trim();
  const sortBy = params.sortBy;
  const sortDir: Prisma.SortOrder = params.sortDir === "desc" ? "desc" : "asc";

  const where = {
    domainIntegrationId: integration.id,
    ...(query
      ? {
          OR: [
            { name: { contains: query, mode: "insensitive" as const } },
            {
              description: {
                contains: query,
                mode: "insensitive" as const,
              },
            },
            {
              expansionString: {
                contains: query,
                mode: "insensitive" as const,
              },
            },
          ],
        }
      : {}),
  } satisfies Prisma.DataSourceExpansionTemplateWhereInput;

  const orderBy =
    sortBy === "createdAt"
      ? ({
          createdAt: sortDir,
        } satisfies Prisma.DataSourceExpansionTemplateOrderByWithRelationInput)
      : ({
          name: sortDir,
        } satisfies Prisma.DataSourceExpansionTemplateOrderByWithRelationInput);

  const args = {
    where,
    skip,
    take: pageSize,
    orderBy,
  } satisfies Prisma.DataSourceExpansionTemplateFindManyArgs;

  const [rows, total] = await Promise.all([
    db.findMany(args),
    db.count({ where }),
  ]);

  return tableV1ListResponseSchema.parse({
    items: rows.map(mapDataSourceExpansionTemplateRowToListItem),
    total,
    page,
    pageSize,
  });
};

export type GetDataSourceExpansionTemplateByIdDependencies = {
  db?: DataSourceExpansionTemplateDelegate;
  getIntegration?: typeof getDomainIntegrationByKey;
};

/**
 * Loads one template by id, scoped to the integration.
 *
 * @param integrationKey - Registered domain integration key.
 * @param id - Template id.
 * @param dependencies - Injectable collaborators.
 * @returns Row fields for the edit form, or null if missing.
 */
export const getDataSourceExpansionTemplateByIdForIntegration = async (
  integrationKey: string,
  id: string,
  dependencies: GetDataSourceExpansionTemplateByIdDependencies = {},
): Promise<Record<string, unknown> | null> => {
  const db = dependencies.db ?? prisma.dataSourceExpansionTemplate;
  const getIntegration =
    dependencies.getIntegration ?? getDomainIntegrationByKey;

  const integration = await getIntegration(integrationKey);
  if (!integration) {
    throw new Error(
      `Domain integration "${integrationKey}" is not active or not registered`,
    );
  }

  const row = await db.findFirst({
    where: {
      id,
      domainIntegrationId: integration.id,
    } satisfies Prisma.DataSourceExpansionTemplateWhereInput,
  });

  if (!row) return null;

  const mapped = mapDataSourceExpansionTemplateRowToListItem(row);
  return {
    ...mapped,
    createdAt: mapped.createdAt,
    updatedAt: mapped.updatedAt,
  };
};

export type GetDataSourceExpansionTemplateWithUsageDependencies = {
  db?: DataSourceExpansionTemplateDelegate;
  getIntegration?: typeof getDomainIntegrationByKey;
  getUsage?: typeof getPipelinesUsingExpansionString;
};

export type DataSourceExpansionTemplateWithUsage = {
  template: Record<string, unknown>;
  usage: PipelineUsageSummary[];
};

/**
 * Loads one template by id (scoped to integration) plus reverse usage in pipelines.
 *
 * @param integrationKey - Registered domain integration key.
 * @param id - Template id.
 * @param dependencies - Injectable collaborators.
 * @returns Template + pipeline usage, or null if template is missing.
 */
export const getDataSourceExpansionTemplateByIdWithUsageForIntegration = async (
  integrationKey: string,
  id: string,
  dependencies: GetDataSourceExpansionTemplateWithUsageDependencies = {},
): Promise<DataSourceExpansionTemplateWithUsage | null> => {
  const db = dependencies.db ?? prisma.dataSourceExpansionTemplate;
  const getIntegration =
    dependencies.getIntegration ?? getDomainIntegrationByKey;
  const getUsage = dependencies.getUsage ?? getPipelinesUsingExpansionString;

  const integration = await getIntegration(integrationKey);
  if (!integration) {
    throw new Error(
      `Domain integration "${integrationKey}" is not active or not registered`,
    );
  }

  const row = await db.findFirst({
    where: {
      id,
      domainIntegrationId: integration.id,
    } satisfies Prisma.DataSourceExpansionTemplateWhereInput,
  });
  if (!row) {
    return null;
  }

  const mapped = mapDataSourceExpansionTemplateRowToListItem(row);
  const usage = await getUsage(integration.id, row.expansionString);

  return {
    template: {
      ...mapped,
      createdAt: mapped.createdAt,
      updatedAt: mapped.updatedAt,
    },
    usage,
  };
};

export type CreateDataSourceExpansionTemplateDependencies = {
  db?: DataSourceExpansionTemplateDelegate;
  getIntegration?: typeof getDomainIntegrationByKey;
  getSession?: typeof getDashboardSession;
};

/**
 * Creates a template row for the integration.
 *
 * @param integrationKey - Registered domain integration key.
 * @param body - Raw JSON body from the create form.
 * @param dependencies - Injectable DB, session, integration resolver.
 * @returns `{ id }` for the table-v1 create flow.
 */
export const createDataSourceExpansionTemplateForIntegration = async (
  integrationKey: string,
  body: Record<string, unknown>,
  dependencies: CreateDataSourceExpansionTemplateDependencies = {},
): Promise<{ id: string }> => {
  const db = dependencies.db ?? prisma.dataSourceExpansionTemplate;
  const getIntegration =
    dependencies.getIntegration ?? getDomainIntegrationByKey;
  const getSession = dependencies.getSession ?? getDashboardSession;

  const parsed = dataSourceExpansionTemplateCreateBodySchema.safeParse(body);
  if (!parsed.success) {
    throw new Error("Invalid request body");
  }

  const integration = await getIntegration(integrationKey);
  if (!integration) {
    throw new Error(
      `Domain integration "${integrationKey}" is not active or not registered`,
    );
  }

  const session = await getSession();
  const created = await db.create({
    data: {
      domainIntegration: { connect: { id: integration.id } },
      name: parsed.data.name.trim(),
      expansionString: parsed.data.expansionString.trim(),
      description: nullableText(parsed.data.description),
      createdBy: session?.id ? { connect: { id: session.id } } : undefined,
    } satisfies Prisma.DataSourceExpansionTemplateCreateInput,
  });

  return { id: created.id };
};

export type UpdateDataSourceExpansionTemplateDependencies = {
  db?: DataSourceExpansionTemplateDelegate;
  getIntegration?: typeof getDomainIntegrationByKey;
};

/**
 * Updates a template by id (scoped to integration).
 *
 * @param integrationKey - Registered domain integration key.
 * @param id - Template id.
 * @param body - Raw JSON body from the edit form.
 * @param dependencies - Injectable collaborators.
 * @returns `{ id }` on success.
 */
export const updateDataSourceExpansionTemplateForIntegration = async (
  integrationKey: string,
  id: string,
  body: Record<string, unknown>,
  dependencies: UpdateDataSourceExpansionTemplateDependencies = {},
): Promise<{ id: string }> => {
  const db = dependencies.db ?? prisma.dataSourceExpansionTemplate;
  const getIntegration =
    dependencies.getIntegration ?? getDomainIntegrationByKey;

  const parsed = dataSourceExpansionTemplateUpdateBodySchema.safeParse(body);
  if (!parsed.success) {
    throw new Error("Invalid request body");
  }

  const integration = await getIntegration(integrationKey);
  if (!integration) {
    throw new Error(
      `Domain integration "${integrationKey}" is not active or not registered`,
    );
  }

  const result = await db.updateMany({
    where: {
      id,
      domainIntegrationId: integration.id,
    } satisfies Prisma.DataSourceExpansionTemplateWhereInput,
    data: {
      name: parsed.data.name.trim(),
      expansionString: parsed.data.expansionString.trim(),
      description: nullableText(parsed.data.description),
    } satisfies Prisma.DataSourceExpansionTemplateUpdateManyMutationInput,
  });

  if (result.count < 1) {
    throw new Error("Domain dashboard request failed (404)");
  }

  return { id };
};

export type DeleteDataSourceExpansionTemplateDependencies = {
  db?: DataSourceExpansionTemplateDelegate;
  getIntegration?: typeof getDomainIntegrationByKey;
};

/**
 * Deletes a template by id (scoped to integration).
 *
 * @param integrationKey - Registered domain integration key.
 * @param id - Template id.
 * @param dependencies - Injectable collaborators.
 */
export const deleteDataSourceExpansionTemplateForIntegration = async (
  integrationKey: string,
  id: string,
  dependencies: DeleteDataSourceExpansionTemplateDependencies = {},
): Promise<void> => {
  const db = dependencies.db ?? prisma.dataSourceExpansionTemplate;
  const getIntegration =
    dependencies.getIntegration ?? getDomainIntegrationByKey;

  const integration = await getIntegration(integrationKey);
  if (!integration) {
    throw new Error(
      `Domain integration "${integrationKey}" is not active or not registered`,
    );
  }

  const result = await db.deleteMany({
    where: {
      id,
      domainIntegrationId: integration.id,
    } satisfies Prisma.DataSourceExpansionTemplateWhereInput,
  });

  if (result.count < 1) {
    throw new Error("Domain dashboard request failed (404)");
  }
};
