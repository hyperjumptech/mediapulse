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
  agentId: z.string().min(1),
  agentVersion: z.string().min(1),
});

export const requestValidator = createRequestValidator({
  body: bodyValidator,
});

export const responseValidator = z.object({
  stepId: z.string().uuid(),
});

type AddStepHandlerDependencies = {
  getSession?: typeof getDashboardSession;
  db?: typeof prisma;
};

type AddStepHandler = HandlerFunc<
  typeof requestValidator,
  typeof responseValidator,
  undefined
>;

/**
 * Creates the add-step handler with injectable dependencies for tests.
 *
 * @param dependencies - Optional getSession and db.
 * @returns Handler that adds a pipeline step (validates agent exists in registry).
 */
export const createAddStepHandler = ({
  getSession = getDashboardSession,
  db = prisma,
}: AddStepHandlerDependencies = {}): AddStepHandler => {
  return async (data) => {
    const session = await getSession();
    if (!session) {
      return errorResponse("Unauthorized");
    }

    const { pipelineId, agentId, agentVersion } = data.body;

    const agent = await db.agentRegistry.findFirst({
      where: { agentId, agentVersion, isActive: true },
    });
    if (!agent) {
      return errorResponse(
        `Agent ${agentId}@${agentVersion} not found in registry`,
      );
    }

    const maxOrder = await db.pipelineStep.aggregate({
      where: { pipelineId },
      _max: { order: true },
    });
    const nextOrder = (maxOrder._max.order ?? -1) + 1;

    const step = await db.pipelineStep.create({
      data: {
        pipelineId,
        agentId,
        agentVersion,
        order: nextOrder,
      },
    });

    return successResponse({ stepId: step.id });
  };
};

/**
 * Handles add pipeline step: validates session and agent, appends step.
 */
export const handler: AddStepHandler = createAddStepHandler();
