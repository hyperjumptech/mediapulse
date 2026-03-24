import { prisma } from "@hermes/orchestration-database";
import {
  createRequestValidator,
  HandlerFunc,
  successResponse,
} from "route-action-gen/lib";
import { z } from "zod";

import { requireDashboardSessionForRoute } from "@/lib/auth-dashboard";

const bodyValidator = z.object({
  pipelineId: z.string().uuid(),
});

export const requestValidator = createRequestValidator({
  body: bodyValidator,
  user: requireDashboardSessionForRoute,
});

export const responseValidator = z.object({
  ok: z.literal(true),
});

type DeletePipelineHandlerDependencies = {
  db?: typeof prisma;
};

type DeletePipelineHandler = HandlerFunc<
  typeof requestValidator,
  typeof responseValidator,
  undefined
>;

/**
 * Creates the delete-pipeline handler with injectable dependencies for tests.
 *
 * @param dependencies - Optional db client for tests.
 * @returns Handler that deletes a pipeline (steps cascade).
 */
export const createDeletePipelineHandler = ({
  db = prisma,
}: DeletePipelineHandlerDependencies = {}): DeletePipelineHandler => {
  return async (data) => {
    await db.pipeline.delete({
      where: { id: data.body.pipelineId },
    });

    return successResponse({ ok: true as const });
  };
};

/**
 * Handles delete pipeline: validates session and deletes pipeline (steps cascade).
 */
export const handler: DeletePipelineHandler = createDeletePipelineHandler();
