import { prisma } from "@hermes/orchestration-database";
import {
  createRequestValidator,
  errorResponse,
  HandlerFunc,
  successResponse,
} from "route-action-gen/lib";
import { z } from "zod";

import { requireMutationDashboardPrincipalForRoute } from "@/lib/require-mutation-dashboard-principal-for-route";
import { withDashboardRevalidation } from "@/lib/revalidate-dashboard";

const bodyValidator = z.object({
  pipelineId: z.guid(),
});

export const requestValidator = createRequestValidator({
  body: bodyValidator,
  user: requireMutationDashboardPrincipalForRoute,
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
    const referencingSteps = await db.pipelineStep.findMany({
      where: { targetPipelineId: data.body.pipelineId },
      select: { pipeline: { select: { name: true } } },
    });
    if (referencingSteps.length > 0) {
      const pipelineNames = [
        ...new Set(referencingSteps.map((step) => step.pipeline.name)),
      ].join(", ");

      return errorResponse(
        `Used as a step in: ${pipelineNames}. Remove those steps first.`,
      );
    }
    await db.pipeline.delete({
      where: { id: data.body.pipelineId },
    });

    return successResponse({ ok: true as const });
  };
};

/**
 * Handles delete pipeline: validates session and deletes pipeline (steps cascade).
 */
export const handler: DeletePipelineHandler = withDashboardRevalidation(
  createDeletePipelineHandler(),
);
