import type { Prisma, PrismaClient } from "@hermes/orchestration-database";

import type {
  CompositionPipeline,
  LoadCompositionPipeline,
} from "./resolve-pipeline-composition";

export type LoadCompositionPipelineDb = {
  pipeline: Pick<PrismaClient["pipeline"], "findUnique">;
};

const compositionPipelineSelect = {
  id: true,
  name: true,
  timeout: true,
  domainIntegrationId: true,
  steps: {
    orderBy: { order: "asc" },
    include: {
      agentConfig: true,
      agentContract: { select: { brief: true, version: true } },
    },
  },
} satisfies Prisma.PipelineSelect;

export const createCompositionPipelineLoader = (
  db: LoadCompositionPipelineDb,
): LoadCompositionPipeline => {
  const cache = new Map<string, Promise<CompositionPipeline | null>>();

  return (pipelineId) => {
    const cached = cache.get(pipelineId);
    if (cached !== undefined) {
      return cached;
    }
    const loading = db.pipeline.findUnique({
      where: { id: pipelineId },
      select: compositionPipelineSelect,
    });
    cache.set(pipelineId, loading);

    return loading;
  };
};
