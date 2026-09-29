import { prisma } from "@hermes/orchestration-database";
import {
  createRequestValidator,
  errorResponse,
  type HandlerFunc,
  successResponse,
} from "route-action-gen/lib";
import { z } from "zod";

import { checkPipelineStepsComposition } from "@/lib/check-pipeline-steps-composition";
import { requireMutationDashboardPrincipalForRoute } from "@/lib/require-mutation-dashboard-principal-for-route";
import { withDashboardRevalidation } from "@/lib/revalidate-dashboard";

const bodyValidator = z.object({
  pipelineId: z.guid(),
  targetPipelineId: z.guid(),
});

export const requestValidator = createRequestValidator({
  body: bodyValidator,
  user: requireMutationDashboardPrincipalForRoute,
});

export const responseValidator = z.object({
  stepId: z.guid(),
});

type AddPipelineStepHandler = HandlerFunc<
  typeof requestValidator,
  typeof responseValidator,
  undefined
>;

const PROPOSED_STEP_ID = "proposed-pipeline-step";

export const createAddPipelineStepHandler = ({
  db = prisma,
}: {
  db?: typeof prisma;
} = {}): AddPipelineStepHandler => {
  return async (data) => {
    const { pipelineId, targetPipelineId } = data.body;
    const maxOrder = await db.pipelineStep.aggregate({
      where: { pipelineId },
      _max: { order: true },
    });
    const nextOrder = (maxOrder._max.order ?? -1) + 1;
    const check = await checkPipelineStepsComposition({
      db,
      pipelineId,
      proposeSteps: (currentSteps) => [
        ...currentSteps,
        {
          id: PROPOSED_STEP_ID,
          order: nextOrder,
          kind: "pipeline",
          agentId: null,
          agentVersion: null,
          targetPipelineId,
          input: {},
        },
      ],
    });
    if (!check.valid) {
      return errorResponse(check.message);
    }
    const step = await db.pipelineStep.create({
      data: {
        pipelineId,
        order: nextOrder,
        kind: "pipeline",
        targetPipelineId,
        input: {},
        config: {},
        createdById: data.user.id,
      },
      select: { id: true },
    });

    return successResponse({ stepId: step.id });
  };
};

export const handler: AddPipelineStepHandler = withDashboardRevalidation(
  createAddPipelineStepHandler(),
);
