import { prisma } from "@workspace/database";
import {
  createRequestValidator,
  errorResponse,
  HandlerFunc,
  successResponse,
} from "route-action-gen/lib";
import { z } from "zod";

import { getDashboardSession } from "@/lib/auth-dashboard";

const bodyValidator = z.object({
  pipelineId: z.string().uuid(),
  stepId: z.string().uuid(),
  agentId: z.string().min(1),
  agentVersion: z.string().min(1),
});

export const requestValidator = createRequestValidator({
  body: bodyValidator,
});

export const responseValidator = z.object({
  ok: z.literal(true),
});

type UpdateStepHandlerDependencies = {
  getSession?: typeof getDashboardSession;
  db?: typeof prisma;
};

type UpdateStepHandler = HandlerFunc<
  typeof requestValidator,
  typeof responseValidator,
  undefined
>;

/**
 * Creates the update-step handler with injectable dependencies for tests.
 *
 * @param dependencies - Optional getSession and db.
 * @returns Handler that updates a pipeline step (agentId/agentVersion) and persists to DB.
 */
export const createUpdateStepHandler = ({
  getSession = getDashboardSession,
  db = prisma,
}: UpdateStepHandlerDependencies = {}): UpdateStepHandler => {
  return async (data) => {
    const session = await getSession();
    if (!session) {
      return errorResponse("Unauthorized");
    }

    const { pipelineId, stepId, agentId, agentVersion } = data.body;

    const step = await db.pipelineStep.findFirst({
      where: { id: stepId, pipelineId },
    });
    if (!step) {
      return errorResponse("Step not found");
    }

    const agent = await db.agentRegistry.findFirst({
      where: { agentId, agentVersion, isActive: true },
    });
    if (!agent) {
      return errorResponse(
        `Agent ${agentId}@${agentVersion} not found in registry`,
      );
    }

    await db.pipelineStep.update({
      where: { id: stepId },
      data: { agentId, agentVersion },
    });

    return successResponse({ ok: true as const });
  };
};

/**
 * Handles update pipeline step: validates session, step, and agent; persists changes to DB.
 */
export const handler: UpdateStepHandler = createUpdateStepHandler();
