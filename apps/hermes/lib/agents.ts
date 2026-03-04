import { prisma } from "@workspace/database";

type Db = typeof prisma;

export type AgentsPageResult = {
  agents: Awaited<ReturnType<Db["agentRegistry"]["findMany"]>>;
  total: number;
  page: number;
  pageSize: number;
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

export type AgentSortField = "agentId" | "agentVersion" | "created";
export type AgentSortDir = "asc" | "desc";

const SORT_DEFAULT: { sortBy: AgentSortField; sortDir: AgentSortDir } = {
  sortBy: "agentId",
  sortDir: "asc",
};

/**
 * Builds Prisma orderBy from sort field and direction. "created" maps to createdAt.
 *
 * @param sortBy - Field to sort by (agentId, agentVersion, or created).
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
} => {
  const dir = sortDir === "asc" ? "asc" : "desc";
  if (sortBy === "created") return { createdAt: dir };
  if (sortBy === "agentVersion") return { agentVersion: dir };
  return { agentId: dir };
};

/**
 * Fetches a paginated list of agents with optional sort and search.
 *
 * @param page - 1-based page number.
 * @param pageSize - Number of items per page.
 * @param options - Optional search term and sort (sortBy: agentId | agentVersion | created, sortDir: asc | desc).
 * @param db - Prisma client (injectable for tests).
 * @returns Agents for the page plus total count and pagination info.
 */
export const getAgentsPage = async (
  page: number,
  pageSize: number,
  options?: {
    search?: string;
    sortBy?: AgentSortField;
    sortDir?: AgentSortDir;
  },
  db: Db = prisma,
): Promise<AgentsPageResult> => {
  const skip = (page - 1) * pageSize;
  const where = agentSearchWhere(options?.search);
  const sortBy = options?.sortBy ?? SORT_DEFAULT.sortBy;
  const sortDir = options?.sortDir ?? SORT_DEFAULT.sortDir;
  const orderBy = agentOrderBy(sortBy, sortDir);

  const [agents, total] = await Promise.all([
    db.agentRegistry.findMany({
      where,
      skip,
      take: pageSize,
      orderBy,
    }),
    db.agentRegistry.count({ where }),
  ]);
  return { agents, total, page, pageSize };
};

/**
 * Fetches a single agent by id, or null if not found.
 *
 * @param agentId - UUID of the agent registry row.
 * @param db - Prisma client (injectable for tests).
 * @returns The agent or null.
 */
export const getAgentById = async (
  agentId: string,
  db: Db = prisma,
): Promise<Awaited<ReturnType<Db["agentRegistry"]["findUnique"]>>> => {
  return db.agentRegistry.findUnique({
    where: { id: agentId },
  });
};
