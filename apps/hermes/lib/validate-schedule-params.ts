import type { PrismaClient } from "@workspace/database";
import { validateDataSourceExpressions } from "@workspace/hermes-scheduler";

import { validateWithJsonSchema } from "./validate-json-schema";

/**
 * Loads the pipeline's steps and their agents' input schemas from the registry,
 * validates params against every step's input schema, and validates data source
 * expression syntax and take/limit bounds.
 *
 * @param db - Prisma client.
 * @param pipelineId - Pipeline to load.
 * @param params - Schedule params (input) to validate.
 * @returns Object with valid: true, or valid: false and message listing errors.
 */
export async function validateScheduleParams(
  db: PrismaClient,
  pipelineId: string,
  params: Record<string, unknown>,
): Promise<{ valid: true } | { valid: false; message: string }> {
  const dsValidation = validateDataSourceExpressions(params);
  if (!dsValidation.valid) {
    return { valid: false, message: dsValidation.errors.join(". ") };
  }

  const pipeline = await db.pipeline.findUnique({
    where: { id: pipelineId },
    include: { steps: { orderBy: { order: "asc" } } },
  });
  if (!pipeline || pipeline.steps.length === 0) {
    return { valid: true };
  }

  const seen = new Set<string>();
  const orConditions: { agentId: string; agentVersion: string }[] = [];
  for (const s of pipeline.steps) {
    const key = `${s.agentId}\0${s.agentVersion}`;
    if (!seen.has(key)) {
      seen.add(key);
      orConditions.push({ agentId: s.agentId, agentVersion: s.agentVersion });
    }
  }
  const agents = await db.agentRegistry.findMany({
    where: { OR: orConditions, isActive: true },
    select: { agentId: true, agentVersion: true, inputSchema: true },
  });
  const agentByKey = new Map(
    agents.map((a) => [`${a.agentId}:${a.agentVersion}`, a]),
  );

  const errors: string[] = [];
  for (const step of pipeline.steps) {
    const agent = agentByKey.get(`${step.agentId}:${step.agentVersion}`);
    if (!agent) {
      errors.push(
        `Agent ${step.agentId}@${step.agentVersion} not found in registry`,
      );
      continue;
    }
    if (agent.inputSchema == null || typeof agent.inputSchema !== "object") {
      errors.push(
        `Agent ${step.agentId}@${step.agentVersion} has no input schema in registry`,
      );
      continue;
    }
    const result = validateWithJsonSchema(
      agent.inputSchema as Record<string, unknown>,
      params,
    );
    if (!result.valid) {
      errors.push(
        `Params invalid for ${step.agentId}@${step.agentVersion}: ${result.errors.join("; ")}`,
      );
    }
  }

  if (errors.length > 0) {
    return { valid: false, message: errors.join(". ") };
  }
  return { valid: true };
}
