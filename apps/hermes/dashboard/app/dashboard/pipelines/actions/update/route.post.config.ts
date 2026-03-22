import { prisma } from "@hermes/orchestration-database";
import {
  createRequestValidator,
  errorResponse,
  HandlerFunc,
  successResponse,
} from "route-action-gen/lib";
import { z } from "zod";

import { getDashboardSession } from "@/lib/auth-dashboard";
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
  steps: z.array(stepItemValidator).optional(),
});

export const requestValidator = createRequestValidator({
  body: bodyValidator,
});

export const responseValidator = z.object({
  ok: z.literal(true),
});

type UpdatePipelineHandlerDependencies = {
  getSession?: typeof getDashboardSession;
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
 * @param dependencies - Optional getSession and db.
 * @returns Handler that updates a pipeline (and optionally syncs steps to DB).
 */
export const createUpdatePipelineHandler = ({
  getSession = getDashboardSession,
  db = prisma,
}: UpdatePipelineHandlerDependencies = {}): UpdatePipelineHandler => {
  return async (data) => {
    const session = await getSession();
    if (!session) {
      return errorResponse("Unauthorized");
    }

    const { pipelineId, name, description, isActive, steps } = data.body;
    const updateData: {
      name?: string;
      description?: string | null;
      isActive?: boolean;
    } = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (isActive !== undefined) updateData.isActive = isActive;

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
