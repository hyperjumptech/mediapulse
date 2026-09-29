import type { Prisma, PrismaClient } from "@hermes/orchestration-database";
import { createCompositionPipelineLoader } from "@hermes/scheduler/load-composition-pipeline";
import {
  resolvePipelineComposition,
  type CompositionPipeline,
  type LoadCompositionPipeline,
} from "@hermes/scheduler/resolve-pipeline-composition";

import { validateDataSourceExpressions } from "@/lib/step-input-expansion";

import type { PipelineValidationResult } from "./pipeline-status";
import { collectEmptyRequiredStringErrors } from "./validate-required-fields";
import { validateWithJsonSchema } from "./validate-json-schema";

export type { PipelineStatus } from "./pipeline-status";
export { getPipelineStatus, getPipelineStatusMap } from "./pipeline-status";
export type { PipelineValidationResult } from "./pipeline-status";

type PipelineValidationStepRecord = {
  id?: string;
  order?: number;
  kind?: "agent" | "pipeline";
  agentId: string | null;
  agentVersion: string | null;
  targetPipelineId?: string | null;
  agentConfigId: string | null;
  agentContractId?: string | null;
  input: unknown;
  config: unknown;
};

type PipelineWithSteps = {
  id: string;
  name: string;
  domainIntegrationId: string;
  timeout?: number | null;
  steps: PipelineValidationStepRecord[];
};

type PipelineValidationStep = {
  agentId: string;
  agentVersion: string;
  agentConfigId: string | null;
  input: unknown;
  config: unknown;
};

export type PipelineValidationInput = {
  id: string;
  name?: string;
  domainIntegrationId: string;
  timeout?: number | null;
  steps: PipelineValidationStepRecord[];
};

export type PipelineValidationDb = {
  agentRegistry: Pick<PrismaClient["agentRegistry"], "findMany">;
  agentConfig: Pick<PrismaClient["agentConfig"], "findMany">;
  pipeline: Pick<PrismaClient["pipeline"], "findUnique">;
};

export const pipelineValidationStepsArgs = {
  orderBy: { order: "asc" },
  select: {
    id: true,
    order: true,
    kind: true,
    agentId: true,
    agentVersion: true,
    targetPipelineId: true,
    agentConfigId: true,
    input: true,
    config: true,
  },
} satisfies Prisma.Pipeline$stepsArgs;

type AgentValidationEntry = {
  label: string;
  step: PipelineValidationStep;
};

type PipelineValidationPlan = {
  entries: AgentValidationEntry[];
  warnings: string[];
};

const registryAgentSchemasSelect = {
  agentId: true,
  agentVersion: true,
  domainIntegrationId: true,
  inputSchema: true,
  configSchema: true,
} satisfies Prisma.AgentRegistrySelect;

type RegistryAgentSchemas = Prisma.AgentRegistryGetPayload<{
  select: typeof registryAgentSchemasSelect;
}>;

const savedAgentConfigSelect = {
  id: true,
  config: true,
} satisfies Prisma.AgentConfigSelect;

type SavedAgentConfig = Prisma.AgentConfigGetPayload<{
  select: typeof savedAgentConfigSelect;
}>;

type RegistryAgentIdentity = {
  domainIntegrationId: string;
  agentId: string;
  agentVersion: string;
};

type PipelineValidationLookups = {
  registryAgentsByKey: Map<string, RegistryAgentSchemas>;
  savedAgentConfigsById: Map<string, SavedAgentConfig>;
};

type RequiredFieldsSchema = { type?: string | string[]; required?: string[] };

const registryAgentKey = (identity: RegistryAgentIdentity): string =>
  JSON.stringify([
    identity.domainIntegrationId,
    identity.agentId,
    identity.agentVersion,
  ]);

const toPlainObject = (value: unknown): Record<string, unknown> =>
  value != null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const agentStepLabel = (
  stepNumber: number,
  agentId: string,
  agentVersion: string,
): string => `Step ${stepNumber} (${agentId}@${agentVersion})`;

const planDirectSteps = (
  pipeline: PipelineValidationInput,
): PipelineValidationPlan => {
  const entries: AgentValidationEntry[] = [];
  const warnings: string[] = [];
  for (const [stepIndex, step] of pipeline.steps.entries()) {
    if (!step) continue;
    const stepNumber = stepIndex + 1;
    if (step.agentId == null || step.agentVersion == null) {
      warnings.push(`Step ${stepNumber}: no agent selected`);
      continue;
    }
    entries.push({
      label: agentStepLabel(stepNumber, step.agentId, step.agentVersion),
      step: {
        agentId: step.agentId,
        agentVersion: step.agentVersion,
        agentConfigId: step.agentConfigId,
        input: step.input,
        config: step.config,
      },
    });
  }

  return { entries, warnings };
};

const compositionStepId = (
  pipeline: PipelineValidationInput,
  step: PipelineValidationStepRecord,
  stepIndex: number,
): string => step.id ?? `${pipeline.id}:${stepIndex}`;

const toCompositionPipeline = (
  pipeline: PipelineValidationInput,
): CompositionPipeline => ({
  id: pipeline.id,
  name: pipeline.name ?? pipeline.id,
  timeout: pipeline.timeout ?? null,
  domainIntegrationId: pipeline.domainIntegrationId,
  steps: pipeline.steps.flatMap((step, stepIndex) => {
    if (!step) return [];

    return [
      {
        id: compositionStepId(pipeline, step, stepIndex),
        order: step.order ?? stepIndex,
        kind: step.kind ?? "agent",
        agentId: step.agentId,
        agentVersion: step.agentVersion,
        targetPipelineId: step.targetPipelineId ?? null,
        input: step.input,
        config: step.config,
        agentConfigId: step.agentConfigId,
      },
    ];
  }),
});

const planComposedSteps = async (
  pipeline: PipelineValidationInput,
  loadPipeline: LoadCompositionPipeline,
): Promise<PipelineValidationPlan> => {
  const root = toCompositionPipeline(pipeline);
  const rootStepNumberById = new Map(
    pipeline.steps.flatMap((step, stepIndex) =>
      step
        ? [
            [
              compositionStepId(pipeline, step, stepIndex),
              stepIndex + 1,
            ] as const,
          ]
        : [],
    ),
  );
  const composition = await resolvePipelineComposition({
    root,
    loadPipeline,
  });
  const warnings = composition.errors.map((error) => error.message);
  const entries = composition.steps.map((step) => {
    const rootStepId = step.includedVia[0]?.pipelineStepId ?? step.id;
    const stepNumber = rootStepNumberById.get(rootStepId) ?? step.position + 1;
    const agentLabel = `${step.agentId}@${step.agentVersion}`;
    const label =
      step.includedVia.length > 0
        ? `Step ${stepNumber} (pipeline ${step.sourcePipeline.name}) › ${agentLabel}`
        : agentStepLabel(stepNumber, step.agentId, step.agentVersion);

    return {
      label,
      step: {
        agentId: step.agentId,
        agentVersion: step.agentVersion,
        agentConfigId: step.agentConfigId,
        input: step.input,
        config: step.config,
      },
    };
  });

  return { entries, warnings };
};

const planPipelineValidation = async (
  pipeline: PipelineValidationInput,
  loadPipeline: LoadCompositionPipeline,
): Promise<PipelineValidationPlan> => {
  const usesComposition = pipeline.steps.some(
    (step) => step?.kind === "pipeline",
  );
  if (!usesComposition) {
    return planDirectSteps(pipeline);
  }

  return planComposedSteps(pipeline, loadPipeline);
};

const collectValidationLookupKeys = (
  pipelines: Array<{
    domainIntegrationId: string;
    plan: PipelineValidationPlan;
  }>,
): {
  registryAgentIdentities: RegistryAgentIdentity[];
  agentConfigIds: string[];
} => {
  const registryAgentIdentitiesByKey = new Map<string, RegistryAgentIdentity>();
  const agentConfigIds = new Set<string>();
  for (const pipeline of pipelines) {
    for (const { step } of pipeline.plan.entries) {
      const identity = {
        domainIntegrationId: pipeline.domainIntegrationId,
        agentId: step.agentId,
        agentVersion: step.agentVersion,
      };
      registryAgentIdentitiesByKey.set(registryAgentKey(identity), identity);
      if (step.agentConfigId != null) {
        agentConfigIds.add(step.agentConfigId);
      }
    }
  }

  return {
    registryAgentIdentities: [...registryAgentIdentitiesByKey.values()],
    agentConfigIds: [...agentConfigIds],
  };
};

const findRegistryAgentSchemas = async (
  registryAgentIdentities: RegistryAgentIdentity[],
  db: PipelineValidationDb,
): Promise<RegistryAgentSchemas[]> => {
  if (registryAgentIdentities.length === 0) {
    return [];
  }
  const findManyArgs = {
    where: { isActive: true, OR: registryAgentIdentities },
    select: registryAgentSchemasSelect,
  } satisfies Prisma.AgentRegistryFindManyArgs;

  return db.agentRegistry.findMany(findManyArgs);
};

const findSavedAgentConfigs = async (
  agentConfigIds: string[],
  db: PipelineValidationDb,
): Promise<SavedAgentConfig[]> => {
  if (agentConfigIds.length === 0) {
    return [];
  }
  const findManyArgs = {
    where: { id: { in: agentConfigIds } },
    select: savedAgentConfigSelect,
  } satisfies Prisma.AgentConfigFindManyArgs;

  return db.agentConfig.findMany(findManyArgs);
};

const loadValidationLookups = async (
  pipelines: Array<{
    domainIntegrationId: string;
    plan: PipelineValidationPlan;
  }>,
  db: PipelineValidationDb,
): Promise<PipelineValidationLookups> => {
  const { registryAgentIdentities, agentConfigIds } =
    collectValidationLookupKeys(pipelines);
  const [registryAgents, savedAgentConfigs] = await Promise.all([
    findRegistryAgentSchemas(registryAgentIdentities, db),
    findSavedAgentConfigs(agentConfigIds, db),
  ]);
  const registryAgentsByKey = new Map<string, RegistryAgentSchemas>(
    registryAgents.map((registryAgent) => [
      registryAgentKey(registryAgent),
      registryAgent,
    ]),
  );
  const savedAgentConfigsById = new Map<string, SavedAgentConfig>(
    savedAgentConfigs.map((savedAgentConfig) => [
      savedAgentConfig.id,
      savedAgentConfig,
    ]),
  );

  return { registryAgentsByKey, savedAgentConfigsById };
};

const collectStepWarnings = (
  stepLabel: string,
  step: PipelineValidationStep,
  registryAgent: RegistryAgentSchemas,
  savedAgentConfigsById: Map<string, SavedAgentConfig>,
): string[] => {
  const warnings: string[] = [];
  const inputObject = toPlainObject(step.input);
  const configObject = toPlainObject(step.config);
  const dataSourceValidation = validateDataSourceExpressions(inputObject);
  if (!dataSourceValidation.valid) {
    const dataSourceErrors = dataSourceValidation.errors.join("; ");
    warnings.push(`${stepLabel} input: ${dataSourceErrors}`);
  }

  const { inputSchema, configSchema } = registryAgent;

  if (inputSchema != null && typeof inputSchema === "object") {
    const emptyRequiredErrors = collectEmptyRequiredStringErrors(
      inputSchema as RequiredFieldsSchema,
      inputObject,
    );
    const ajvResult = validateWithJsonSchema(
      inputSchema as Record<string, unknown>,
      inputObject,
    );
    if (emptyRequiredErrors.length > 0) {
      warnings.push(`${stepLabel} input: ${emptyRequiredErrors.join("; ")}`);
    }
    if (!ajvResult.valid) {
      warnings.push(`${stepLabel} input: ${ajvResult.errors.join("; ")}`);
    }
  }

  if (configSchema != null && typeof configSchema === "object") {
    let effectiveConfig = configObject;
    if (step.agentConfigId != null) {
      const savedAgentConfig = savedAgentConfigsById.get(step.agentConfigId);
      if (!savedAgentConfig) {
        warnings.push(`${stepLabel}: saved config not found`);
      } else {
        effectiveConfig = toPlainObject(savedAgentConfig.config);
      }
    }
    const emptyRequiredErrors = collectEmptyRequiredStringErrors(
      configSchema as RequiredFieldsSchema,
      effectiveConfig,
    );
    if (emptyRequiredErrors.length > 0) {
      warnings.push(`${stepLabel} config: ${emptyRequiredErrors.join("; ")}`);
    }
    const ajvResult = validateWithJsonSchema(
      configSchema as Record<string, unknown>,
      effectiveConfig,
    );
    if (!ajvResult.valid) {
      warnings.push(`${stepLabel} config: ${ajvResult.errors.join("; ")}`);
    }
  }

  return warnings;
};

const validatePipelineWithLookups = (
  domainIntegrationId: string,
  plan: PipelineValidationPlan,
  lookups: PipelineValidationLookups,
): PipelineValidationResult => {
  const warnings: string[] = [...plan.warnings];
  for (const { label: stepLabel, step } of plan.entries) {
    const registryAgent = lookups.registryAgentsByKey.get(
      registryAgentKey({
        domainIntegrationId,
        agentId: step.agentId,
        agentVersion: step.agentVersion,
      }),
    );
    if (!registryAgent) {
      warnings.push(`${stepLabel}: agent not found in registry`);
      continue;
    }
    const stepWarnings = collectStepWarnings(
      stepLabel,
      step,
      registryAgent,
      lookups.savedAgentConfigsById,
    );
    warnings.push(...stepWarnings);
  }

  return {
    valid: warnings.length === 0,
    warnings,
  };
};

/**
 * Validates a pipeline's steps: each step's input/config against agent schemas,
 * and data source expressions in input. Returns valid: false if any step fails.
 *
 * @param pipeline - Pipeline with steps (from getPipelineWithSteps).
 * @param db - Prisma client used to load the agent registry and saved configs.
 * @returns Validation result with valid flag and list of warning messages.
 */
export async function validatePipeline(
  pipeline: PipelineWithSteps,
  db: PipelineValidationDb,
): Promise<PipelineValidationResult> {
  const plan = await planPipelineValidation(
    pipeline,
    createCompositionPipelineLoader(db),
  );
  const planned = [{ domainIntegrationId: pipeline.domainIntegrationId, plan }];
  const lookups = await loadValidationLookups(planned, db);

  return validatePipelineWithLookups(
    pipeline.domainIntegrationId,
    plan,
    lookups,
  );
}

/**
 * Validates multiple pipelines and returns a map of pipeline id to validation result.
 * Used by schedule UI to disable invalid pipelines in the pipeline dropdown.
 *
 * @param pipelines - Pipelines with steps ordered by step order.
 * @param db - Prisma client.
 * @returns Map of pipeline id to validation result.
 */
export async function getPipelinesValidationMap(
  pipelines: PipelineValidationInput[],
  db: PipelineValidationDb,
): Promise<Record<string, PipelineValidationResult>> {
  const loadPipeline = createCompositionPipelineLoader(db);
  const planned = await Promise.all(
    pipelines.map(async (pipeline) => ({
      id: pipeline.id,
      domainIntegrationId: pipeline.domainIntegrationId,
      plan: await planPipelineValidation(pipeline, loadPipeline),
    })),
  );
  const lookups = await loadValidationLookups(planned, db);
  const entries = planned.map((pipeline) => {
    const validation = validatePipelineWithLookups(
      pipeline.domainIntegrationId,
      pipeline.plan,
      lookups,
    );

    return [pipeline.id, validation] as const;
  });

  return Object.fromEntries(entries);
}
