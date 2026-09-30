import { prisma } from "@hermes/orchestration-database";

import type { PipelineValidationResult } from "@/lib/pipeline-status";
import { getPipelineRunParamKeys } from "@/lib/pipeline-run-param-keys";
import { getPipelineWithSteps } from "@/lib/pipelines";
import { validatePipeline } from "@/lib/validate-pipeline";

type PipelineWithSteps = NonNullable<
  Awaited<ReturnType<typeof getPipelineWithSteps>>
>;

export type PipelineDetailApiDependencies = {
  getPipeline: (pipelineId: string) => Promise<PipelineWithSteps | null>;
  validate: (pipeline: PipelineWithSteps) => Promise<PipelineValidationResult>;
  getRunParamKeys: (pipelineId: string) => Promise<string[]>;
};

const defaultDependencies: PipelineDetailApiDependencies = {
  getPipeline: (pipelineId) => getPipelineWithSteps(pipelineId),
  validate: (pipeline) => validatePipeline(pipeline, prisma),
  getRunParamKeys: (pipelineId) => getPipelineRunParamKeys(pipelineId, prisma),
};

export const getPipelineDetailForApi = async (
  pipelineId: string,
  dependencies: PipelineDetailApiDependencies = defaultDependencies,
) => {
  const pipeline = await dependencies.getPipeline(pipelineId);
  if (!pipeline) {
    return null;
  }
  const [validation, runParamKeys] = await Promise.all([
    dependencies.validate(pipeline),
    dependencies.getRunParamKeys(pipeline.id),
  ]);

  return { ...pipeline, validation, runParamKeys };
};
