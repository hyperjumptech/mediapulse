import { createCompositionPipelineLoader } from "@hermes/scheduler/load-composition-pipeline";
import { resolvePipelineComposition } from "@hermes/scheduler/resolve-pipeline-composition";
import { findRunParamKeys } from "@hermes/scheduler/run-params";

import type { LoadCompositionPipelineDb } from "@hermes/scheduler/load-composition-pipeline";

export const getPipelineRunParamKeys = async (
  pipelineId: string,
  db: LoadCompositionPipelineDb,
): Promise<string[]> => {
  const loadPipeline = createCompositionPipelineLoader(db);
  const root = await loadPipeline(pipelineId);
  if (!root) {
    return [];
  }
  const composition = await resolvePipelineComposition({ root, loadPipeline });
  const placeholderSources = composition.steps.flatMap((step) => [
    step.input,
    step.agentConfig?.config ?? step.config,
  ]);

  return findRunParamKeys(placeholderSources);
};
