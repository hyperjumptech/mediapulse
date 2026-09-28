import { prisma } from "@hermes/orchestration-database";
import type { Prisma, PrismaClient } from "@hermes/orchestration-database";

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
    createdBy: { name: string; email: string } | null;
  }>;
  total: number;
  page: number;
  pageSize: number;
};

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

const agentConfigSearchWhere = (
  search: string | undefined,
): Prisma.AgentConfigWhereInput | undefined => {
  const term = search?.trim();
  if (!term) return undefined;

  return {
    OR: [
      { name: { contains: term, mode: "insensitive" } },
      { description: { contains: term, mode: "insensitive" } },
      { agentId: { contains: term, mode: "insensitive" } },
    ],
  };
};

export const getAgentConfigsPage = async (
  page: number,
  pageSize: number,
  options?: {
    agentId?: string;
    agentVersion?: string;
    search?: string;
    sortBy?: AgentConfigSortField;
    sortDir?: AgentConfigSortDir;
  },
  db: Db = prisma,
): Promise<AgentConfigsPageResult> => {
  const skip = (page - 1) * pageSize;
  const where: Prisma.AgentConfigWhereInput = {
    ...agentConfigSearchWhere(options?.search),
  };
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
      include: {
        createdBy: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    }),
    db.agentConfig.count({ where }),
  ]);
  return { configs, total, page, pageSize };
};

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
