import type { EnqueueDiagnosticEntry } from "./enqueue-diagnostics";
import { createCompositionPipelineLoader } from "./load-composition-pipeline";
import {
  planPipelineInvocations,
  type PlannedInvocation,
  type PlanPipelineInvocationsArgs,
} from "./plan-pipeline-invocations";
import {
  resolvePipelineComposition,
  type ComposedAgentStep,
  type CompositionPipeline,
  type LoadCompositionPipeline,
} from "./resolve-pipeline-composition";

export type ComposedPlannedInvocation = PlannedInvocation & {
  position: number;
  timeoutMs: number;
};

export type ComposeAndPlanPipelineRunArgs = Omit<
  PlanPipelineInvocationsArgs,
  "pipeline"
> & {
  root: CompositionPipeline;
  defaultTimeoutMs: number;
  loadPipeline?: LoadCompositionPipeline;
};

export type ComposeAndPlanPipelineRunResult = {
  waveList: ComposedPlannedInvocation[][];
  errors: EnqueueDiagnosticEntry[];
  secretValues: readonly string[];
  composedSteps: ComposedAgentStep[];
};

export const composeAndPlanPipelineRun = async ({
  root,
  defaultTimeoutMs,
  loadPipeline,
  ...planningArgs
}: ComposeAndPlanPipelineRunArgs): Promise<ComposeAndPlanPipelineRunResult> => {
  const composition = await resolvePipelineComposition({
    root,
    loadPipeline:
      loadPipeline ?? createCompositionPipelineLoader(planningArgs.db),
  });
  if (composition.errors.length > 0) {
    const timestamp = new Date().toISOString();

    return {
      waveList: [],
      errors: composition.errors.map((error) => ({
        message: error.message,
        timestamp,
        phase: "planning",
        pipelineStepId: error.pipelineStepId,
      })),
      secretValues: [],
      composedSteps: [],
    };
  }

  const planning = await planPipelineInvocations({
    ...planningArgs,
    pipeline: {
      id: root.id,
      domainIntegrationId: root.domainIntegrationId,
      steps: composition.steps,
    },
  });
  const composedStepById = new Map(
    composition.steps.map((step) => [step.id, step]),
  );
  const waveList = planning.waveList.map((wave) =>
    wave.map((planned) => {
      const composedStep = composedStepById.get(planned.pipelineStepId);
      const timeoutMs =
        composedStep?.sourcePipeline.timeout ??
        root.timeout ??
        defaultTimeoutMs;

      return {
        ...planned,
        position: composedStep?.position ?? 0,
        timeoutMs,
      };
    }),
  );

  return {
    waveList,
    errors: planning.errors,
    secretValues: planning.secretValues,
    composedSteps: composition.steps,
  };
};
