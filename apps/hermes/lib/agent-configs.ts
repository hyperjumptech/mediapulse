import { prisma } from "@workspace/database";
import type { PrismaClient } from "@workspace/database";

type Db = typeof prisma;

export type AgentConfigSortField = "name" | "createdAt" | "agentId";
export type AgentConfigSortDir = "asc" | "desc";

export type AgentConfigsPageResult = {
  configs: Array<{
    id: string;
    name: string;
    description: string | null;
    agentId: string;
    agentVersion: string;
    config: unknown;
    configSchemaFingerprint: string | null;
    createdAt: Date;
  }>;
  total: number;
  page: number;
  pageSize: number;
};

/**
 * Builds Prisma orderBy for agent config list.
 */
const agentConfigOrderBy = (
  sortBy: AgentConfigSortField,
  sortDir: AgentConfigSortDir,
): {
  name?: "asc" | "desc";
  createdAt?: "asc" | "desc";
  agentId?: "asc" | "desc";
} => {
  const dir = sortDir === "asc" ? "asc" : "desc";
  if (sortBy === "createdAt") return { createdAt: dir };
  if (sortBy === "agentId") return { agentId: dir };
  return { name: dir };
};

/**
 * Fetches a paginated list of agent configs with optional filter by agent and sort.
 *
 * @param page - 1-based page number.
 * @param pageSize - Number of items per page.
 * @param options - Optional agentId, agentVersion, sort.
 * @param db - Prisma client (injectable for tests).
 * @returns Configs for the page plus total and pagination info.
 */
export const getAgentConfigsPage = async (
  page: number,
  pageSize: number,
  options?: {
    agentId?: string;
    agentVersion?: string;
    sortBy?: AgentConfigSortField;
    sortDir?: AgentConfigSortDir;
  },
  db: Db = prisma,
): Promise<AgentConfigsPageResult> => {
  const skip = (page - 1) * pageSize;
  const where: { agentId?: string; agentVersion?: string } = {};
  if (options?.agentId != null) where.agentId = options.agentId;
  if (options?.agentVersion != null) where.agentVersion = options.agentVersion;

  const sortBy = options?.sortBy ?? "name";
  const sortDir = options?.sortDir ?? "asc";
  const orderBy = agentConfigOrderBy(sortBy, sortDir);

  const [configs, total] = await Promise.all([
    db.agentConfig.findMany({
      where,
      skip,
      take: pageSize,
      orderBy,
    }),
    db.agentConfig.count({ where }),
  ]);
  return { configs, total, page, pageSize };
};

/**
 * Fetches a single agent config by id, or null if not found.
 *
 * @param id - UUID of the agent config.
 * @param db - Prisma client (injectable for tests).
 * @returns The agent config or null.
 */
export const getAgentConfigById = async (
  id: string,
  db: Db = prisma,
): Promise<Awaited<
  ReturnType<PrismaClient["agentConfig"]["findUnique"]>
> | null> => {
  return db.agentConfig.findUnique({
    where: { id },
  });
};

/**
 * Fetches all agent configs for a given agent (agentId + agentVersion).
 * Used by pipeline step dropdown to list configs for the selected agent.
 *
 * @param agentId - Agent ID.
 * @param agentVersion - Agent version.
 * @param db - Prisma client (injectable for tests).
 * @returns List of configs for that agent, ordered by name.
 */
export const getAgentConfigsForAgent = async (
  agentId: string,
  agentVersion: string,
  db: Db = prisma,
): Promise<
  Array<{
    id: string;
    name: string;
    description: string | null;
    configSchemaFingerprint: string | null;
  }>
> => {
  const configs = await db.agentConfig.findMany({
    where: { agentId, agentVersion },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      description: true,
      configSchemaFingerprint: true,
    },
  });
  return configs;
};

export type AgentConfigSummary = {
  id: string;
  name: string;
  description: string | null;
  configSchemaFingerprint: string | null;
};

/**
 * Fetches agent configs for multiple agents in one query; returns a map of agentKey -> configs.
 *
 * @param agentKeys - Array of { agentId, agentVersion }.
 * @param db - Prisma client (injectable for tests).
 * @returns Map from "agentId@agentVersion" to list of config summaries.
 */
export const getAgentConfigsByAgentKeys = async (
  agentKeys: Array<{ agentId: string; agentVersion: string }>,
  db: Db = prisma,
): Promise<Record<string, AgentConfigSummary[]>> => {
  if (agentKeys.length === 0) return {};
  const keys = [
    ...new Set(agentKeys.map((a) => `${a.agentId}\0${a.agentVersion}`)),
  ];
  const orConditions = keys.map((k) => {
    const [agentId, agentVersion] = k.split("\0");
    return { agentId: agentId!, agentVersion: agentVersion! };
  });
  const configs = await db.agentConfig.findMany({
    where: { OR: orConditions },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      description: true,
      configSchemaFingerprint: true,
      agentId: true,
      agentVersion: true,
    },
  });
  const map: Record<string, AgentConfigSummary[]> = {};
  for (const c of configs) {
    const key = `${c.agentId}@${c.agentVersion}`;
    if (!map[key]) map[key] = [];
    map[key].push({
      id: c.id,
      name: c.name,
      description: c.description,
      configSchemaFingerprint: c.configSchemaFingerprint,
    });
  }
  return map;
};
