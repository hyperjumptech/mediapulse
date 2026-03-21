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
});

export const requestValidator = createRequestValidator({
  body: bodyValidator,
});

export const responseValidator = z.object({
  ok: z.literal(true),
});

type DeletePipelineHandlerDependencies = {
  getSession?: typeof getDashboardSession;
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
 * @param dependencies - Optional getSession and db.
 * @returns Handler that deletes a pipeline (steps cascade).
 */
export const createDeletePipelineHandler = ({
  getSession = getDashboardSession,
  db = prisma,
}: DeletePipelineHandlerDependencies = {}): DeletePipelineHandler => {
  return async (data) => {
    const session = await getSession();
    if (!session) {
      return errorResponse("Unauthorized");
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
export const handler: DeletePipelineHandler = createDeletePipelineHandler();
