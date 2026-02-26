import { prisma } from "@workspace/database";

type Db = typeof prisma;

/**
 * Fetches all pipelines with their steps, ordered by updatedAt descending.
 *
 * @param db - Prisma client (injectable for tests).
 * @returns Pipelines with steps included.
 */
export const getPipelinesWithSteps = async (db: Db = prisma) => {
  return db.pipeline.findMany({
    include: { steps: { orderBy: { order: "asc" } } },
    orderBy: { updatedAt: "desc" },
  });
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
    include: { steps: { orderBy: { order: "asc" } } },
  });
};

/**
 * Fetches all active agent registry entries for the "add step" palette.
 *
 * @param db - Prisma client (injectable for tests).
 * @returns Agent registry entries.
 */
export const getAgentRegistryList = async (db: Db = prisma) => {
  return db.agentRegistry.findMany({
    where: { isActive: true },
    orderBy: [{ agentId: "asc" }, { agentVersion: "asc" }],
  });
};
