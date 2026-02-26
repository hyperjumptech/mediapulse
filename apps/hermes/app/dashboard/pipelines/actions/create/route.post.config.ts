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
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  isActive: z.coerce.boolean().optional().default(true),
});

export const requestValidator = createRequestValidator({
  body: bodyValidator,
});

export const responseValidator = z.object({
  id: z.string().uuid(),
});

type CreatePipelineHandlerDependencies = {
  getSession?: typeof getDashboardSession;
  db?: typeof prisma;
};

type CreatePipelineHandler = HandlerFunc<
  typeof requestValidator,
  typeof responseValidator,
  undefined
>;

/**
 * Creates the create-pipeline handler with injectable dependencies for tests.
 *
 * @param dependencies - Optional getSession and db.
 * @returns Handler that creates a pipeline and returns its id.
 */
export const createCreatePipelineHandler = ({
  getSession = getDashboardSession,
  db = prisma,
}: CreatePipelineHandlerDependencies = {}): CreatePipelineHandler => {
  return async (data) => {
    const session = await getSession();
    if (!session) {
      return errorResponse("Unauthorized");
    }

    const { name, description, isActive } = data.body;
    const pipeline = await db.pipeline.create({
      data: {
        name,
        description: description ?? null,
        isActive: isActive ?? true,
      },
    });

    return successResponse({ id: pipeline.id });
  };
};

/**
 * Handles create pipeline: validates session and creates pipeline in DB.
 */
export const handler: CreatePipelineHandler = createCreatePipelineHandler();
