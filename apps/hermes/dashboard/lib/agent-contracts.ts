import { prisma } from "@hermes/orchestration-database";
import type { PrismaClient } from "@hermes/orchestration-database";

type Db = typeof prisma;

export type AgentContractSortField = "name" | "createdAt";
export type AgentContractSortDir = "asc" | "desc";

export type AgentContractSummary = {
  id: string;
  name: string;
  description: string | null;
  version: string;
};

const agentContractOrderBy = (
  sortBy: AgentContractSortField,
  sortDir: AgentContractSortDir,
): { name?: "asc" | "desc"; createdAt?: "asc" | "desc" } => {
  const dir = sortDir === "asc" ? "asc" : "desc";
  if (sortBy === "createdAt") return { createdAt: dir };
  return { name: dir };
};

export const getAgentContractsPage = async (
  page: number,
  pageSize: number,
  options?: { sortBy?: AgentContractSortField; sortDir?: AgentContractSortDir },
  db: Db = prisma,
) => {
  const skip = (page - 1) * pageSize;
  const sortBy = options?.sortBy ?? "name";
  const sortDir = options?.sortDir ?? "asc";
  const orderBy = agentContractOrderBy(sortBy, sortDir);

  const [contracts, total] = await Promise.all([
    db.agentContract.findMany({
      skip,
      take: pageSize,
      orderBy,
      include: { createdBy: { select: { name: true, email: true } } },
    }),
    db.agentContract.count(),
  ]);
  return { contracts, total, page, pageSize };
};

export const getAgentContractById = async (
  id: string,
  db: Db = prisma,
): Promise<Awaited<
  ReturnType<PrismaClient["agentContract"]["findUnique"]>
> | null> => {
  return db.agentContract.findUnique({ where: { id } });
};

export const getAllAgentContracts = async (
  db: Db = prisma,
): Promise<AgentContractSummary[]> => {
  const contracts = await db.agentContract.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, description: true, version: true },
  });
  return contracts;
};
