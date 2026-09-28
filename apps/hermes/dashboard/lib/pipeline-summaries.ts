import type { Prisma, PrismaClient } from "@hermes/orchestration-database";
import { prisma } from "@hermes/orchestration-database";

import type { PipelineValidationResult } from "./pipeline-status";
import {
  getPipelinesValidationMap,
  pipelineValidationStepsArgs,
  type PipelineValidationDb,
} from "./validate-pipeline";

export type PipelineSummariesDb = PipelineValidationDb & {
  pipeline: Pick<PrismaClient["pipeline"], "findMany">;
};

const pipelineSummarySelect = {
  id: true,
  name: true,
  description: true,
  isActive: true,
  createdById: true,
  createdBy: { select: { id: true, name: true, email: true } },
} satisfies Prisma.PipelineSelect;

export type PipelineSummary = Prisma.PipelineGetPayload<{
  select: typeof pipelineSummarySelect;
}>;

export type PipelineSummariesWithValidation = {
  pipelines: PipelineSummary[];
  pipelineValidationById: Record<string, PipelineValidationResult>;
};

const pipelineSummariesWithStepsFindManyArgs = {
  select: {
    ...pipelineSummarySelect,
    domainIntegrationId: true,
    steps: pipelineValidationStepsArgs,
  },
  orderBy: { updatedAt: "desc" },
} satisfies Prisma.PipelineFindManyArgs;

export const getPipelineSummariesWithValidation = async (
  db: PipelineSummariesDb = prisma,
): Promise<PipelineSummariesWithValidation> => {
  const pipelines = await db.pipeline.findMany(
    pipelineSummariesWithStepsFindManyArgs,
  );
  const pipelineValidationById = await getPipelinesValidationMap(pipelines, db);
  const pipelineSummaries = pipelines.map((pipeline) => ({
    id: pipeline.id,
    name: pipeline.name,
    description: pipeline.description,
    isActive: pipeline.isActive,
    createdById: pipeline.createdById,
    createdBy: pipeline.createdBy,
  }));

  return { pipelines: pipelineSummaries, pipelineValidationById };
};
