import { prisma } from "@hermes/orchestration-database";
import {
  createRequestValidator,
  errorResponse,
  HandlerFunc,
  successResponse,
} from "route-action-gen/lib";
import { z } from "zod";

import { requireDashboardSessionForRoute } from "@/lib/auth-dashboard";
import { disableSchedulesForPipelineIfNotEnabled } from "@/lib/disable-schedules-for-pipeline";
import { zFormBoolean } from "@/lib/form-boolean-schema";

const stepItemValidator = z.object({
  agentId: z.string().min(1),
  agentVersion: z.string().min(1),
});

const bodyValidator = z.object({
  pipelineId: z.string().uuid(),
  name: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  isActive: zFormBoolean.optional(),
  timeout: z
    .union([z.literal(""), z.coerce.number()])
    .optional()
    .nullable()
    .transform((v): number | null | undefined => {
      if (v === undefined) return undefined;
      if (v === "" || v === null) return null;
      const n = Number(v);
      if (!Number.isFinite(n) || n <= 0) return null;
      return n;
    }),
  steps: z.array(stepItemValidator).optional(),
});

export const requestValidator = createRequestValidator({
  body: bodyValidator,
  user: requireDashboardSessionForRoute,
});

export const responseValidator = z.object({
  ok: z.literal(true),
});

type UpdatePipelineHandlerDependencies = {
  db?: typeof prisma;
};

type UpdatePipelineHandler = HandlerFunc<
  typeof requestValidator,
  typeof responseValidator,
  undefined
>;

/**
 * Syncs pipeline steps to DB: replaces all steps for the pipeline with the given list (order = index).
 * Validates each agent exists in registry before applying.
 *
 * @param db - Prisma client.
 * @param pipelineId - Pipeline id.
 * @param steps - Array of { agentId, agentVersion }.
 * @returns Error message if any agent not in registry, otherwise undefined.
 */
async function syncPipelineSteps(
  db: typeof prisma,
  pipelineId: string,
  steps: Array<{ agentId: string; agentVersion: string }>,
): Promise<string | undefined> {
  const agentKeys = [
    ...new Set(steps.map((s) => `${s.agentId}@${s.agentVersion}`)),
  ];
  for (const key of agentKeys) {
    const [agentId, agentVersion] = key.split("@");
    const agent = await db.agentRegistry.findFirst({
      where: { agentId, agentVersion, isActive: true },
    });
    if (!agent) {
      return `Agent ${agentId}@${agentVersion} not found in registry`;
    }
  }
  await db.pipelineStep.deleteMany({ where: { pipelineId } });
  for (let i = 0; i < steps.length; i++) {
    await db.pipelineStep.create({
      data: {
        pipelineId,
        agentId: steps[i]!.agentId,
        agentVersion: steps[i]!.agentVersion,
        order: i,
      },
    });
  }
  return undefined;
}

/**
 * Creates the update-pipeline handler with injectable dependencies for tests.
 *
 * @param dependencies - Optional db client for tests.
 * @returns Handler that updates a pipeline (and optionally syncs steps to DB).
 */
export const createUpdatePipelineHandler = ({
  db = prisma,
}: UpdatePipelineHandlerDependencies = {}): UpdatePipelineHandler => {
  return async (data) => {
    const { pipelineId, name, description, isActive, timeout, steps } =
      data.body;
    const updateData: {
      name?: string;
      description?: string | null;
      isActive?: boolean;
      timeout?: number | null;
    } = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (timeout !== undefined) updateData.timeout = timeout;

    if (steps !== undefined) {
      const err = await syncPipelineSteps(db, pipelineId, steps);
      if (err) return errorResponse(err);
    }

    await db.pipeline.update({
      where: { id: pipelineId },
      data: updateData,
    });

    await disableSchedulesForPipelineIfNotEnabled(db, pipelineId);

    return successResponse({ ok: true as const });
  };
};

/**
 * Handles update pipeline: validates session and updates pipeline in DB.
 */
export const handler: UpdatePipelineHandler = createUpdatePipelineHandler();
