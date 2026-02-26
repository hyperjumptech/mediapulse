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
  name: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  isActive: z.coerce.boolean().optional(),
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
 * Creates the update-pipeline handler with injectable dependencies for tests.
 *
 * @param dependencies - Optional getSession and db.
 * @returns Handler that updates a pipeline.
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

    const { pipelineId, name, description, isActive } = data.body;
    const updateData: {
      name?: string;
      description?: string | null;
      isActive?: boolean;
    } = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (isActive !== undefined) updateData.isActive = isActive;

    await db.pipeline.update({
      where: { id: pipelineId },
      data: updateData,
    });

    return successResponse({ ok: true as const });
  };
};

/**
 * Handles update pipeline: validates session and updates pipeline in DB.
 */
export const handler: UpdatePipelineHandler = createUpdatePipelineHandler();
