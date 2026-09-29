export const DEFAULT_MAX_COMPOSITION_DEPTH = 3;

export type CompositionStepKind = "agent" | "pipeline";

export type CompositionPipelineStep = {
  id: string;
  order: number;
  kind: CompositionStepKind;
  agentId: string | null;
  agentVersion: string | null;
  targetPipelineId: string | null;
  input?: unknown;
  config?: unknown;
  agentConfigId?: string | null;
  agentConfig?: { config: unknown } | null;
  agentContractId?: string | null;
  agentContract?: { brief: string; version: string } | null;
};

export type CompositionPipeline = {
  id: string;
  name: string;
  timeout: number | null;
  domainIntegrationId: string;
  steps: CompositionPipelineStep[];
};

export type CompositionSourcePipeline = {
  id: string;
  name: string;
  timeout: number | null;
};

export type CompositionInclusion = {
  pipelineStepId: string;
  pipelineId: string;
  pipelineName: string;
};

export type ComposedAgentStep = {
  id: string;
  order: number;
  position: number;
  agentId: string;
  agentVersion: string;
  input: Record<string, unknown>;
  config: unknown;
  agentConfigId: string | null;
  agentConfig: { config: unknown } | null;
  agentContractId: string | null;
  agentContract: { brief: string; version: string } | null;
  sourcePipeline: CompositionSourcePipeline;
  includedVia: CompositionInclusion[];
};

export type CompositionError = {
  message: string;
  pipelineStepId: string;
};

export type LoadCompositionPipeline = (
  pipelineId: string,
) => Promise<CompositionPipeline | null>;

export type ResolvePipelineCompositionArgs = {
  root: CompositionPipeline;
  loadPipeline: LoadCompositionPipeline;
  maxDepth?: number;
};

export type ResolvePipelineCompositionResult = {
  steps: ComposedAgentStep[];
  errors: CompositionError[];
};

type WalkContext = {
  root: CompositionPipeline;
  loadPipeline: LoadCompositionPipeline;
  maxDepth: number;
  steps: ComposedAgentStep[];
  errors: CompositionError[];
  seenAgentStepIds: Set<string>;
};

type WalkFrame = {
  pipeline: CompositionPipeline;
  ancestry: CompositionPipeline[];
  overrideLayers: Record<string, unknown>[];
  includedVia: CompositionInclusion[];
  depth: number;
};

const toPlainObject = (value: unknown): Record<string, unknown> =>
  value != null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const mergeOverrides = (
  input: unknown,
  overrideLayers: Record<string, unknown>[],
): Record<string, unknown> => {
  const innermostFirst = [...overrideLayers].reverse();

  return innermostFirst.reduce<Record<string, unknown>>(
    (merged, layer) => ({ ...merged, ...layer }),
    { ...toPlainObject(input) },
  );
};

const describeStep = (
  pipeline: CompositionPipeline,
  stepNumber: number,
): string => `Step ${stepNumber} of pipeline "${pipeline.name}"`;

const sortByOrder = (
  steps: CompositionPipelineStep[],
): CompositionPipelineStep[] =>
  [...steps].sort((left, right) => left.order - right.order);

const addAgentStep = (
  context: WalkContext,
  frame: WalkFrame,
  step: CompositionPipelineStep,
  stepNumber: number,
): void => {
  if (step.agentId == null || step.agentVersion == null) {
    context.errors.push({
      message: `${describeStep(frame.pipeline, stepNumber)} has no agent`,
      pipelineStepId: step.id,
    });
    return;
  }
  if (context.seenAgentStepIds.has(step.id)) {
    context.errors.push({
      message: `${describeStep(frame.pipeline, stepNumber)} is reached more than once. Include each pipeline only once.`,
      pipelineStepId: step.id,
    });
    return;
  }
  context.seenAgentStepIds.add(step.id);
  context.steps.push({
    id: step.id,
    order: step.order,
    position: context.steps.length,
    agentId: step.agentId,
    agentVersion: step.agentVersion,
    input: mergeOverrides(step.input, frame.overrideLayers),
    config: step.config ?? {},
    agentConfigId: step.agentConfigId ?? null,
    agentConfig: step.agentConfig ?? null,
    agentContractId: step.agentContractId ?? null,
    agentContract: step.agentContract ?? null,
    sourcePipeline: {
      id: frame.pipeline.id,
      name: frame.pipeline.name,
      timeout: frame.pipeline.timeout,
    },
    includedVia: frame.includedVia,
  });
};

const resolveTargetPipeline = async (
  context: WalkContext,
  frame: WalkFrame,
  step: CompositionPipelineStep,
  stepNumber: number,
): Promise<CompositionPipeline | null> => {
  const stepLabel = describeStep(frame.pipeline, stepNumber);
  if (step.targetPipelineId == null) {
    context.errors.push({
      message: `${stepLabel} does not point at a pipeline`,
      pipelineStepId: step.id,
    });
    return null;
  }
  const cycleStart = frame.ancestry.findIndex(
    (ancestor) => ancestor.id === step.targetPipelineId,
  );
  if (cycleStart !== -1) {
    const cycleNames = frame.ancestry
      .slice(cycleStart)
      .map((ancestor) => ancestor.name);
    const cyclePath = [...cycleNames, cycleNames[0]].join(" › ");
    context.errors.push({
      message: `${stepLabel} creates a pipeline cycle: ${cyclePath}`,
      pipelineStepId: step.id,
    });
    return null;
  }
  if (frame.depth + 1 > context.maxDepth) {
    context.errors.push({
      message: `${stepLabel} nests pipelines more than ${context.maxDepth} levels deep`,
      pipelineStepId: step.id,
    });
    return null;
  }
  const target = await context.loadPipeline(step.targetPipelineId);
  if (!target) {
    context.errors.push({
      message: `${stepLabel} points at a pipeline that no longer exists`,
      pipelineStepId: step.id,
    });
    return null;
  }
  if (target.domainIntegrationId !== context.root.domainIntegrationId) {
    context.errors.push({
      message: `${stepLabel} points at pipeline "${target.name}", which belongs to a different domain integration`,
      pipelineStepId: step.id,
    });
    return null;
  }

  return target;
};

const walkPipeline = async (
  context: WalkContext,
  frame: WalkFrame,
): Promise<void> => {
  for (const [index, step] of sortByOrder(frame.pipeline.steps).entries()) {
    const stepNumber = index + 1;
    if (step.kind !== "pipeline") {
      addAgentStep(context, frame, step, stepNumber);
      continue;
    }
    const target = await resolveTargetPipeline(
      context,
      frame,
      step,
      stepNumber,
    );
    if (!target) {
      continue;
    }
    await walkPipeline(context, {
      pipeline: target,
      ancestry: [...frame.ancestry, target],
      overrideLayers: [...frame.overrideLayers, toPlainObject(step.input)],
      includedVia: [
        ...frame.includedVia,
        {
          pipelineStepId: step.id,
          pipelineId: target.id,
          pipelineName: target.name,
        },
      ],
      depth: frame.depth + 1,
    });
  }
};

export const resolvePipelineComposition = async ({
  root,
  loadPipeline,
  maxDepth = DEFAULT_MAX_COMPOSITION_DEPTH,
}: ResolvePipelineCompositionArgs): Promise<ResolvePipelineCompositionResult> => {
  const context: WalkContext = {
    root,
    loadPipeline,
    maxDepth,
    steps: [],
    errors: [],
    seenAgentStepIds: new Set(),
  };
  await walkPipeline(context, {
    pipeline: root,
    ancestry: [root],
    overrideLayers: [],
    includedVia: [],
    depth: 0,
  });
  if (context.errors.length > 0) {
    return { steps: [], errors: context.errors };
  }

  return { steps: context.steps, errors: [] };
};

export const pipelineUsesComposition = (
  pipeline: Pick<CompositionPipeline, "steps">,
): boolean => pipeline.steps.some((step) => step.kind === "pipeline");
