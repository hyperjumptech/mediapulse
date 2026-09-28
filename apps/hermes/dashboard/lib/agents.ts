import type { Prisma } from "@hermes/orchestration-database";
import { prisma } from "@hermes/orchestration-database";

type Db = typeof prisma;

/** Prisma include for agent fetches that need the domain integration stable id (list + detail). */
export const agentDomainIntegrationIdInclude = {
  domainIntegration: {
    select: {
      integrationId: true,
    },
  },
} satisfies Prisma.AgentRegistryInclude;

/** Registry row with `domainIntegration.integrationId` (list and detail queries). */
export type AgentRegistryWithDomainIntegrationId =
  Prisma.AgentRegistryGetPayload<{
    include: typeof agentDomainIntegrationIdInclude;
  }>;

export type AgentDetail = AgentRegistryWithDomainIntegrationId;

const agentListSelect = {
  id: true,
  agentId: true,
  agentVersion: true,
  description: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  domainIntegration: { select: { integrationId: true } },
} satisfies Prisma.AgentRegistrySelect;

export type AgentListRow = Prisma.AgentRegistryGetPayload<{
  select: typeof agentListSelect;
}>;

export type AgentsPageResult = {
  agents: AgentListRow[];
  total: number;
  page: number;
  pageSize: number;
};

export type AgentRegistryPageResult = {
  agents: AgentRegistryWithDomainIntegrationId[];
  total: number;
  page: number;
  pageSize: number;
};

type AgentsPageOptions = {
  search?: string;
  sortBy?: AgentSortField;
  sortDir?: AgentSortDir;
};

/**
 * Builds a Prisma where clause for agent search by agentId or description (partial, case-insensitive).
 *
 * @param search - Raw search string; trimmed and ignored if empty.
 * @returns Where clause object or undefined if no search.
 */
const agentSearchWhere = (
  search: string | undefined,
):
  | {
      OR: Array<
        | { agentId: { contains: string; mode: "insensitive" } }
        | { description: { contains: string; mode: "insensitive" } }
      >;
    }
  | undefined => {
  const term = search?.trim();
  if (!term) return undefined;
  return {
    OR: [
      { agentId: { contains: term, mode: "insensitive" } },
      { description: { contains: term, mode: "insensitive" } },
    ],
  };
};

export type AgentSortField = "agentId" | "agentVersion" | "created" | "updated";
export type AgentSortDir = "asc" | "desc";

const SORT_DEFAULT: { sortBy: AgentSortField; sortDir: AgentSortDir } = {
  sortBy: "agentId",
  sortDir: "asc",
};

/**
 * Builds Prisma orderBy from sort field and direction. "created" maps to createdAt, "updated" to updatedAt.
 *
 * @param sortBy - Field to sort by (agentId, agentVersion, created, or updated).
 * @param sortDir - asc or desc.
 * @returns Prisma orderBy object.
 */
const agentOrderBy = (
  sortBy: AgentSortField,
  sortDir: AgentSortDir,
): {
  agentId?: "asc" | "desc";
  agentVersion?: "asc" | "desc";
  createdAt?: "asc" | "desc";
  updatedAt?: "asc" | "desc";
} => {
  const dir = sortDir === "asc" ? "asc" : "desc";
  if (sortBy === "created") return { createdAt: dir };
  if (sortBy === "updated") return { updatedAt: dir };
  if (sortBy === "agentVersion") return { agentVersion: dir };
  return { agentId: dir };
};

const agentsPageWindow = (
  page: number,
  pageSize: number,
  options?: AgentsPageOptions,
) => {
  const where = agentSearchWhere(options?.search);
  const skip = (page - 1) * pageSize;
  const sortBy = options?.sortBy ?? SORT_DEFAULT.sortBy;
  const sortDir = options?.sortDir ?? SORT_DEFAULT.sortDir;
  const orderBy = agentOrderBy(sortBy, sortDir);

  return { where, skip, take: pageSize, orderBy };
};

/**
 * Fetches a paginated list of agents with optional sort and search.
 *
 * @param page - 1-based page number.
 * @param pageSize - Number of items per page.
 * @param options - Optional search term and sort (sortBy: agentId | agentVersion | created | updated, sortDir: asc | desc).
 * @param db - Prisma client (injectable for tests).
 * @returns Agents for the page (each with `domainIntegration.integrationId`) plus total count and pagination info.
 */
export const getAgentsPage = async (
  page: number,
  pageSize: number,
  options?: AgentsPageOptions,
  db: Db = prisma,
): Promise<AgentsPageResult> => {
  const pageWindow = agentsPageWindow(page, pageSize, options);
  const findManyArgs = {
    ...pageWindow,
    select: agentListSelect,
  } satisfies Prisma.AgentRegistryFindManyArgs;
  const countArgs = {
    where: pageWindow.where,
  } satisfies Prisma.AgentRegistryCountArgs;
  const [agents, total] = await Promise.all([
    db.agentRegistry.findMany(findManyArgs),
    db.agentRegistry.count(countArgs),
  ]);

  return { agents, total, page, pageSize };
};

export const getAgentRegistryPage = async (
  page: number,
  pageSize: number,
  db: Db = prisma,
): Promise<AgentRegistryPageResult> => {
  const pageWindow = agentsPageWindow(page, pageSize);
  const findManyArgs = {
    ...pageWindow,
    include: agentDomainIntegrationIdInclude,
  } satisfies Prisma.AgentRegistryFindManyArgs;
  const countArgs = {
    where: pageWindow.where,
  } satisfies Prisma.AgentRegistryCountArgs;
  const [agents, total] = await Promise.all([
    db.agentRegistry.findMany(findManyArgs),
    db.agentRegistry.count(countArgs),
  ]);

  return { agents, total, page, pageSize };
};

/**
 * Fetches a single agent by id with its domain integration id, or null if not found.
 *
 * @param agentId - UUID of the agent registry row.
 * @param db - Prisma client (injectable for tests).
 * @returns The agent with `domainIntegration.integrationId`, or null.
 */
export const getAgentById = async (
  agentId: string,
  db: Db = prisma,
): Promise<AgentDetail | null> => {
  const args = {
    where: { id: agentId },
    include: agentDomainIntegrationIdInclude,
  } satisfies Prisma.AgentRegistryFindUniqueArgs;
  return db.agentRegistry.findUnique(args);
};
