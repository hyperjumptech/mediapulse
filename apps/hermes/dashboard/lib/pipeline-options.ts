import type { Prisma, PrismaClient } from "@hermes/orchestration-database";
import { prisma } from "@hermes/orchestration-database";

import type { PipelineValidationResult } from "./pipeline-status";
import {
  getPipelinesValidationMap,
  pipelineValidationStepsArgs,
  type PipelineValidationDb,
} from "./validate-pipeline";

export type PipelineOptionsDb = PipelineValidationDb & {
  pipeline: Pick<PrismaClient["pipeline"], "findMany">;
};

const pipelineOptionSelect = {
  id: true,
  name: true,
  isActive: true,
} satisfies Prisma.PipelineSelect;

export type PipelineOption = Prisma.PipelineGetPayload<{
  select: typeof pipelineOptionSelect;
}>;

export type PipelineOptionsWithValidation = {
  pipelines: PipelineOption[];
  pipelineValidationById: Record<string, PipelineValidationResult>;
};

const pipelineOptionsFindManyArgs = {
  select: pipelineOptionSelect,
  orderBy: { updatedAt: "desc" },
} satisfies Prisma.PipelineFindManyArgs;

const pipelineOptionsWithStepsFindManyArgs = {
  select: {
    ...pipelineOptionSelect,
    domainIntegrationId: true,
    steps: pipelineValidationStepsArgs,
  },
  orderBy: { updatedAt: "desc" },
} satisfies Prisma.PipelineFindManyArgs;

export const getPipelineOptions = async (
  db: Pick<PipelineOptionsDb, "pipeline"> = prisma,
): Promise<PipelineOption[]> => {
  return db.pipeline.findMany(pipelineOptionsFindManyArgs);
};

export const getPipelineOptionsWithValidation = async (
  db: PipelineOptionsDb = prisma,
): Promise<PipelineOptionsWithValidation> => {
  const pipelines = await db.pipeline.findMany(
    pipelineOptionsWithStepsFindManyArgs,
  );
  const pipelineValidationById = await getPipelinesValidationMap(pipelines, db);
  const pipelineOptions = pipelines.map((pipeline) => ({
    id: pipeline.id,
    name: pipeline.name,
    isActive: pipeline.isActive,
  }));

  return { pipelines: pipelineOptions, pipelineValidationById };
};
