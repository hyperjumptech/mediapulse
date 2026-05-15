import { prisma } from "@hermes/orchestration-database";
import {
  createRequestValidator,
  errorResponse,
  HandlerFunc,
  successResponse,
} from "route-action-gen/lib";
import { z } from "zod";

import { requireDashboardPrincipalForRoute } from "@/lib/auth-dashboard";
import { disableSchedulesForPipelineIfNotEnabled } from "@/lib/disable-schedules-for-pipeline";

const bodyValidator = z.object({
  pipelineId: z.string().uuid(),
  stepId: z.string().uuid(),
});

export const requestValidator = createRequestValidator({
  body: bodyValidator,
  user: requireDashboardPrincipalForRoute,
});

export const responseValidator = z.object({
  ok: z.literal(true),
});

type RemoveStepHandlerDependencies = {
  db?: typeof prisma;
};

type RemoveStepHandler = HandlerFunc<
  typeof requestValidator,
  typeof responseValidator,
  undefined
>;

/**
 * Creates the remove-step handler with injectable dependencies for tests.
 *
 * @param dependencies - Optional db client for tests.
 * @returns Handler that removes a pipeline step and renumbers remaining steps.
 */
export const createRemoveStepHandler = ({
  db = prisma,
}: RemoveStepHandlerDependencies = {}): RemoveStepHandler => {
  return async (data) => {
    const { pipelineId, stepId } = data.body;

    const step = await db.pipelineStep.findFirst({
      where: { id: stepId, pipelineId },
    });
    if (!step) {
      return errorResponse("Step not found");
    }

    await db.pipelineStep.delete({
      where: { id: stepId },
    });

    const remaining = await db.pipelineStep.findMany({
      where: { pipelineId },
      orderBy: { order: "asc" },
    });
    for (let i = 0; i < remaining.length; i++) {
      const step = remaining[i];
      if (!step) continue;
      await db.pipelineStep.update({
        where: { id: step.id },
        data: { order: i },
      });
    }

    await disableSchedulesForPipelineIfNotEnabled(db, pipelineId);

    return successResponse({ ok: true as const });
  };
};

/**
 * Handles remove pipeline step: validates session, deletes step, renumbers order.
 */
export const handler: RemoveStepHandler = createRemoveStepHandler();
