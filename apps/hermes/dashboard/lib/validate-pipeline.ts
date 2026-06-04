import type { PrismaClient } from "@hermes/orchestration-database";

import { validateDataSourceExpressions } from "@/lib/step-input-expansion";

import type { PipelineValidationResult } from "./pipeline-status";
import { collectEmptyRequiredStringErrors } from "./validate-required-fields";
import { validateWithJsonSchema } from "./validate-json-schema";

export type { PipelineStatus } from "./pipeline-status";
export { getPipelineStatus, getPipelineStatusMap } from "./pipeline-status";
export type { PipelineValidationResult } from "./pipeline-status";

type PipelineWithSteps = {
  id: string;
  name: string;
  domainIntegrationId: string;
  steps: Array<{
    id: string;
    order: number;
    agentId: string;
    agentVersion: string;
    agentConfigId: string | null;
    agentContractId: string | null;
    input: unknown;
    config: unknown;
  }>;
};

/**
 * Validates a pipeline's steps: each step's input/config against agent schemas,
 * and data source expressions in input. Returns valid: false if any step fails.
 *
 * @param pipeline - Pipeline with steps (from getPipelineWithSteps).
 * @param db - Prisma client to load agent registry for each step.
 * @returns Validation result with valid flag and list of warning messages.
 */
export async function validatePipeline(
  pipeline: PipelineWithSteps,
  db: PrismaClient,
): Promise<PipelineValidationResult> {
  const warnings: string[] = [];

  if (pipeline.steps.length === 0) {
    return { valid: true, warnings: [] };
  }

  for (let i = 0; i < pipeline.steps.length; i++) {
    const step = pipeline.steps[i];
    if (!step) continue;
    const stepLabel = `Step ${i + 1} (${step.agentId}@${step.agentVersion})`;

    const agent = await db.agentRegistry.findFirst({
      where: {
        agentId: step.agentId,
        agentVersion: step.agentVersion,
        isActive: true,
        domainIntegrationId: pipeline.domainIntegrationId,
      },
    });

    if (!agent) {
      warnings.push(`${stepLabel}: agent not found in registry`);
      continue;
    }

    const inputObj =
      step.input != null &&
      typeof step.input === "object" &&
      !Array.isArray(step.input)
        ? (step.input as Record<string, unknown>)
        : {};
    const configObj =
      step.config != null &&
      typeof step.config === "object" &&
      !Array.isArray(step.config)
        ? (step.config as Record<string, unknown>)
        : {};

    const dataSourceValidation = validateDataSourceExpressions(inputObj);
    if (!dataSourceValidation.valid) {
      warnings.push(
        `${stepLabel} input: ${dataSourceValidation.errors.join("; ")}`,
      );
    }

    if (agent.inputSchema != null && typeof agent.inputSchema === "object") {
      const emptyRequiredErrors = collectEmptyRequiredStringErrors(
        agent.inputSchema as { type?: string | string[]; required?: string[] },
        inputObj,
      );
      const ajvResult = validateWithJsonSchema(
        agent.inputSchema as Record<string, unknown>,
        inputObj,
      );
      if (emptyRequiredErrors.length > 0) {
        warnings.push(`${stepLabel} input: ${emptyRequiredErrors.join("; ")}`);
      }
      if (!ajvResult.valid) {
        warnings.push(`${stepLabel} input: ${ajvResult.errors.join("; ")}`);
      }
    }

    if (agent.configSchema != null && typeof agent.configSchema === "object") {
      let effectiveConfig = configObj;
      if (step.agentConfigId != null) {
        const savedConfig = await db.agentConfig.findFirst({
          where: { id: step.agentConfigId },
        });
        if (!savedConfig) {
          warnings.push(`${stepLabel}: saved config not found`);
        } else {
          effectiveConfig =
            savedConfig.config != null &&
            typeof savedConfig.config === "object" &&
            !Array.isArray(savedConfig.config)
              ? (savedConfig.config as Record<string, unknown>)
              : {};
        }
      }
      const emptyRequiredErrors = collectEmptyRequiredStringErrors(
        agent.configSchema as { type?: string | string[]; required?: string[] },
        effectiveConfig,
      );
      if (emptyRequiredErrors.length > 0) {
        warnings.push(`${stepLabel} config: ${emptyRequiredErrors.join("; ")}`);
      }
      const ajvResult = validateWithJsonSchema(
        agent.configSchema as Record<string, unknown>,
        effectiveConfig,
      );
      if (!ajvResult.valid) {
        warnings.push(`${stepLabel} config: ${ajvResult.errors.join("; ")}`);
      }
    }
  }

  return {
    valid: warnings.length === 0,
    warnings,
  };
}

/**
 * Validates multiple pipelines and returns a map of pipeline id to validation result.
 * Used by schedule UI to disable invalid pipelines in the pipeline dropdown.
 *
 * @param pipelines - Pipelines with steps (from getPipelinesWithSteps).
 * @param db - Prisma client.
 * @returns Map of pipeline id to validation result.
 */
export async function getPipelinesValidationMap(
  pipelines: PipelineWithSteps[],
  db: PrismaClient,
): Promise<Record<string, PipelineValidationResult>> {
  const entries = await Promise.all(
    pipelines.map(async (p) => {
      const result = await validatePipeline(p, db);
      return [p.id, result] as const;
    }),
  );
  return Object.fromEntries(entries);
}
