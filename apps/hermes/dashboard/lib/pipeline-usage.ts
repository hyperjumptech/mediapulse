import { type Prisma, prisma } from "@hermes/orchestration-database";

type PipelineUsageDb = {
  pipelineStep: Pick<typeof prisma.pipelineStep, "findMany">;
  pipeline: Pick<typeof prisma.pipeline, "findMany">;
};

type PipelineUsageAccumulator = {
  id: string;
  name: string;
  matchCount: number;
  matchedStepIds: Set<string>;
};

export type PipelineUsageSummary = {
  id: string;
  name: string;
  matchCount: number;
  matchedStepIds: string[];
};

type PipelineStepUsageRow = Prisma.PipelineStepGetPayload<{
  select: {
    id: true;
    input: true;
    config: true;
    pipeline: {
      select: {
        id: true;
        name: true;
      };
    };
  };
}>;

type PipelineExecutionConfigUsageRow = Prisma.PipelineGetPayload<{
  select: {
    id: true;
    name: true;
    executionConfig: true;
  };
}>;

const VARIABLE_PLACEHOLDER_REGEX = /\{\{([^{}]+)\}\}/g;

/**
 * Collects every string leaf from an unknown JSON-like value.
 *
 * @param value - JSON-like value to traverse recursively.
 * @returns Flat array of string leaves.
 */
export const collectStringLeaves = (value: unknown): string[] => {
  if (typeof value === "string") {
    return [value];
  }
  if (Array.isArray(value)) {
    return value.flatMap((item) => collectStringLeaves(item));
  }
  if (value !== null && typeof value === "object") {
    return Object.values(value).flatMap((item) => collectStringLeaves(item));
  }
  return [];
};

/**
 * Counts placeholder matches for a specific variable key inside one string.
 * Matching semantics align with scheduler substitution (`{{ key }}` trims key).
 *
 * @param text - String to inspect for `{{...}}` placeholders.
 * @param variableKey - Variable key to match after trimming placeholder content.
 * @returns Number of occurrences in the string.
 */
export const countVariableKeyMatchesInString = (
  text: string,
  variableKey: string,
): number => {
  return Array.from(text.matchAll(VARIABLE_PLACEHOLDER_REGEX)).reduce(
    (count, match) => {
      const key = String(match[1] ?? "").trim();
      return key === variableKey ? count + 1 : count;
    },
    0,
  );
};

/**
 * Counts exact expansion-string matches in one string leaf.
 *
 * @param text - String leaf to compare.
 * @param expansionString - Target expansion string.
 * @returns 1 for exact match, otherwise 0.
 */
export const countExpansionStringMatchesInString = (
  text: string,
  expansionString: string,
): number => (text === expansionString ? 1 : 0);

/**
 * Accumulates usage counts and matched step ids for one pipeline.
 *
 * @param usageByPipeline - Mutable usage map keyed by pipeline id.
 * @param pipelineId - Pipeline id.
 * @param pipelineName - Pipeline display name.
 * @param matchCount - Number of matches to add.
 * @param stepId - Optional step id where the match occurred.
 */
const addPipelineUsageMatch = (
  usageByPipeline: Map<string, PipelineUsageAccumulator>,
  pipelineId: string,
  pipelineName: string,
  matchCount: number,
  stepId?: string,
): void => {
  if (matchCount < 1) {
    return;
  }

  const existing = usageByPipeline.get(pipelineId);
  if (!existing) {
    const next: PipelineUsageAccumulator = {
      id: pipelineId,
      name: pipelineName,
      matchCount,
      matchedStepIds: new Set(stepId ? [stepId] : []),
    };
    usageByPipeline.set(pipelineId, next);
    return;
  }

  existing.matchCount += matchCount;
  if (stepId) {
    existing.matchedStepIds.add(stepId);
  }
};

/**
 * Builds final, serializable pipeline usage rows sorted by name.
 *
 * @param usageByPipeline - Mutable usage map.
 * @returns Sorted pipeline usage summaries.
 */
const toUsageSummaries = (
  usageByPipeline: Map<string, PipelineUsageAccumulator>,
): PipelineUsageSummary[] => {
  return Array.from(usageByPipeline.values())
    .map((usage) => ({
      id: usage.id,
      name: usage.name,
      matchCount: usage.matchCount,
      matchedStepIds: Array.from(usage.matchedStepIds),
    }))
    .sort((left, right) => left.name.localeCompare(right.name));
};

/**
 * Finds pipelines that reference a variable placeholder key in step JSON
 * (`input` / `config`) and pipeline `executionConfig`.
 *
 * @param variableKey - Placeholder key (without braces), e.g. `API_KEY`.
 * @param db - Injectable Prisma delegates for tests.
 * @returns Deduplicated pipeline usage summaries.
 */
export const getPipelinesUsingVariableKey = async (
  variableKey: string,
  db: PipelineUsageDb = prisma,
): Promise<PipelineUsageSummary[]> => {
  const trimmedKey = variableKey.trim();
  if (trimmedKey.length === 0) {
    return [];
  }

  const stepArgs = {
    select: {
      id: true,
      input: true,
      config: true,
      pipeline: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  } satisfies Prisma.PipelineStepFindManyArgs;

  const pipelineArgs = {
    select: {
      id: true,
      name: true,
      executionConfig: true,
    },
  } satisfies Prisma.PipelineFindManyArgs;

  const [steps, pipelines] = await Promise.all([
    db.pipelineStep.findMany(stepArgs),
    db.pipeline.findMany(pipelineArgs),
  ]);

  const usageByPipeline = new Map<string, PipelineUsageAccumulator>();

  for (const step of steps as PipelineStepUsageRow[]) {
    const leaves = [
      ...collectStringLeaves(step.input),
      ...collectStringLeaves(step.config),
    ];
    const stepMatchCount = leaves.reduce(
      (count, leaf) =>
        count + countVariableKeyMatchesInString(leaf, trimmedKey),
      0,
    );
    addPipelineUsageMatch(
      usageByPipeline,
      step.pipeline.id,
      step.pipeline.name,
      stepMatchCount,
      step.id,
    );
  }

  for (const pipeline of pipelines as PipelineExecutionConfigUsageRow[]) {
    const executionConfigMatchCount = collectStringLeaves(
      pipeline.executionConfig,
    ).reduce(
      (count, leaf) =>
        count + countVariableKeyMatchesInString(leaf, trimmedKey),
      0,
    );
    addPipelineUsageMatch(
      usageByPipeline,
      pipeline.id,
      pipeline.name,
      executionConfigMatchCount,
    );
  }

  return toUsageSummaries(usageByPipeline);
};

/**
 * Finds pipelines (scoped to one domain integration) that reference an exact
 * data-source expansion string in step JSON or pipeline `executionConfig`.
 *
 * @param domainIntegrationId - Integration scope for pipelines.
 * @param expansionString - Exact expansion string to match (e.g. `db:ticker:id`).
 * @param db - Injectable Prisma delegates for tests.
 * @returns Deduplicated pipeline usage summaries.
 */
export const getPipelinesUsingExpansionString = async (
  domainIntegrationId: string,
  expansionString: string,
  db: PipelineUsageDb = prisma,
): Promise<PipelineUsageSummary[]> => {
  const trimmedExpansionString = expansionString.trim();
  if (trimmedExpansionString.length === 0) {
    return [];
  }

  const where = {
    pipeline: {
      domainIntegrationId,
    },
  } satisfies Prisma.PipelineStepWhereInput;

  const stepArgs = {
    where,
    select: {
      id: true,
      input: true,
      config: true,
      pipeline: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  } satisfies Prisma.PipelineStepFindManyArgs;

  const pipelineArgs = {
    where: {
      domainIntegrationId,
    },
    select: {
      id: true,
      name: true,
      executionConfig: true,
    },
  } satisfies Prisma.PipelineFindManyArgs;

  const [steps, pipelines] = await Promise.all([
    db.pipelineStep.findMany(stepArgs),
    db.pipeline.findMany(pipelineArgs),
  ]);

  const usageByPipeline = new Map<string, PipelineUsageAccumulator>();

  for (const step of steps as PipelineStepUsageRow[]) {
    const leaves = [
      ...collectStringLeaves(step.input),
      ...collectStringLeaves(step.config),
    ];
    const stepMatchCount = leaves.reduce(
      (count, leaf) =>
        count +
        countExpansionStringMatchesInString(leaf, trimmedExpansionString),
      0,
    );
    addPipelineUsageMatch(
      usageByPipeline,
      step.pipeline.id,
      step.pipeline.name,
      stepMatchCount,
      step.id,
    );
  }

  for (const pipeline of pipelines as PipelineExecutionConfigUsageRow[]) {
    const executionConfigMatchCount = collectStringLeaves(
      pipeline.executionConfig,
    ).reduce(
      (count, leaf) =>
        count +
        countExpansionStringMatchesInString(leaf, trimmedExpansionString),
      0,
    );
    addPipelineUsageMatch(
      usageByPipeline,
      pipeline.id,
      pipeline.name,
      executionConfigMatchCount,
    );
  }

  return toUsageSummaries(usageByPipeline);
};
