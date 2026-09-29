import {
  createCompositionPipelineLoader,
  type LoadCompositionPipelineDb,
} from "@hermes/scheduler/load-composition-pipeline";
import {
  resolvePipelineComposition,
  type CompositionPipelineStep,
} from "@hermes/scheduler/resolve-pipeline-composition";

export type ProposePipelineSteps = (
  currentSteps: CompositionPipelineStep[],
) => CompositionPipelineStep[];

export type CheckPipelineStepsCompositionResult =
  | { valid: true }
  | { valid: false; message: string };

export const checkPipelineStepsComposition = async ({
  db,
  pipelineId,
  proposeSteps,
}: {
  db: LoadCompositionPipelineDb;
  pipelineId: string;
  proposeSteps: ProposePipelineSteps;
}): Promise<CheckPipelineStepsCompositionResult> => {
  const loadPipeline = createCompositionPipelineLoader(db);
  const pipeline = await loadPipeline(pipelineId);
  if (!pipeline) {
    return { valid: false, message: "Pipeline not found" };
  }
  const composition = await resolvePipelineComposition({
    root: { ...pipeline, steps: proposeSteps(pipeline.steps) },
    loadPipeline,
  });
  if (composition.errors.length === 0) {
    return { valid: true };
  }
  const messages = composition.errors.map((error) => error.message);

  return { valid: false, message: messages.join(". ") };
};

export const includedPipelineStepLabels = async ({
  db,
  pipelineId,
}: {
  db: LoadCompositionPipelineDb;
  pipelineId: string;
}): Promise<Record<string, string[]>> => {
  const loadPipeline = createCompositionPipelineLoader(db);
  const pipeline = await loadPipeline(pipelineId);
  if (!pipeline) {
    return {};
  }
  const composition = await resolvePipelineComposition({
    root: pipeline,
    loadPipeline,
  });
  const labelsByStepId: Record<string, string[]> = {};
  for (const step of composition.steps) {
    const rootStepId = step.includedVia[0]?.pipelineStepId;
    if (rootStepId === undefined) continue;
    const label = `${step.sourcePipeline.name} › ${step.agentId}@${step.agentVersion}`;
    labelsByStepId[rootStepId] = [...(labelsByStepId[rootStepId] ?? []), label];
  }

  return labelsByStepId;
};
