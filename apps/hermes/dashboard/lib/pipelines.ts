import type { Prisma } from "@hermes/orchestration-database";
import { prisma } from "@hermes/orchestration-database";

type Db = typeof prisma;

const pipelineListInclude = {
  steps: { orderBy: { order: "asc" as const } },
  createdBy: { select: { id: true, name: true, email: true } },
} satisfies Prisma.PipelineInclude;

export type PipelineListRow = Prisma.PipelineGetPayload<{
  include: typeof pipelineListInclude;
}>;

export type PipelinesPageResult = {
  pipelines: PipelineListRow[];
  total: number;
  page: number;
  pageSize: number;
};

/**
 * Fetches all pipelines with their steps, ordered by updatedAt descending.
 *
 * @param db - Prisma client (injectable for tests).
 * @returns Pipelines with steps included.
 */
export const getPipelinesWithSteps = async (db: Db = prisma) => {
  return db.pipeline.findMany({
    include: pipelineListInclude,
    orderBy: { updatedAt: "desc" },
  });
};

/**
 * Fetches a paginated list of pipelines with steps, ordered by updatedAt descending.
 *
 * @param page - 1-based page number.
 * @param pageSize - Number of items per page.
 * @param db - Prisma client (injectable for tests).
 * @returns Pipelines for the page plus total count and pagination info.
 */
export const getPipelinesPage = async (
  page: number,
  pageSize: number,
  db: Db = prisma,
): Promise<PipelinesPageResult> => {
  const skip = (page - 1) * pageSize;
  const findManyArgs = {
    include: pipelineListInclude,
    orderBy: { updatedAt: "desc" as const },
    skip,
    take: pageSize,
  } satisfies Prisma.PipelineFindManyArgs;

  const [pipelines, total] = await Promise.all([
    db.pipeline.findMany(findManyArgs),
    db.pipeline.count(),
  ]);
  return { pipelines, total, page, pageSize };
};

/**
 * Fetches a single pipeline by id with its steps, or null if not found.
 *
 * @param pipelineId - UUID of the pipeline.
 * @param db - Prisma client (injectable for tests).
 * @returns Pipeline with steps or null.
 */
export const getPipelineWithSteps = async (
  pipelineId: string,
  db: Db = prisma,
) => {
  return db.pipeline.findUnique({
    where: { id: pipelineId },
    include: {
      steps: { orderBy: { order: "asc" } },
      createdBy: { select: { id: true, name: true, email: true } },
    },
  });
};

/**
 * Fetches all active agent registry entries for the "add step" palette.
 *
 * @param db - Prisma client (injectable for tests).
 * @returns Agent registry entries.
 */
export const getAgentRegistryList = async (
  db: Db = prisma,
  domainIntegrationId?: string,
) => {
  return db.agentRegistry.findMany({
    where: {
      isActive: true,
      ...(domainIntegrationId != null ? { domainIntegrationId } : {}),
    },
    orderBy: [{ agentId: "asc" }, { agentVersion: "asc" }],
  });
};
