import type { Prisma } from "@hermes/orchestration-database";
import { prisma } from "@hermes/orchestration-database";

type Db = typeof prisma;

const agentRegistryListSelect = {
  id: true,
  agentId: true,
  agentVersion: true,
  description: true,
} satisfies Prisma.AgentRegistrySelect;

export const getPipelineWithSteps = async (
  pipelineId: string,
  db: Db = prisma,
) => {
  return db.pipeline.findUnique({
    where: { id: pipelineId },
    include: {
      steps: {
        orderBy: { order: "asc" },
        include: { targetPipeline: { select: { id: true, name: true } } },
      },
      createdBy: { select: { id: true, name: true, email: true } },
    },
  });
};

export const getAgentRegistryList = async (
  db: Db = prisma,
  domainIntegrationId?: string,
) => {
  const domainIntegrationWhere =
    domainIntegrationId != null ? { domainIntegrationId } : {};
  const findManyArgs = {
    where: { isActive: true, ...domainIntegrationWhere },
    select: agentRegistryListSelect,
    orderBy: [{ agentId: "asc" }, { agentVersion: "asc" }],
  } satisfies Prisma.AgentRegistryFindManyArgs;

  return db.agentRegistry.findMany(findManyArgs);
};

export type ComposablePipelineOption = {
  id: string;
  name: string;
  description: string | null;
};

export const getComposablePipelineOptions = async (
  pipeline: { id: string; domainIntegrationId: string },
  db: Db = prisma,
): Promise<ComposablePipelineOption[]> => {
  const findManyArgs = {
    where: {
      domainIntegrationId: pipeline.domainIntegrationId,
      id: { not: pipeline.id },
    },
    select: { id: true, name: true, description: true },
    orderBy: { name: "asc" },
  } satisfies Prisma.PipelineFindManyArgs;

  return db.pipeline.findMany(findManyArgs);
};
