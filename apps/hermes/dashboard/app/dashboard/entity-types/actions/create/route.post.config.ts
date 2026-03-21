import { prisma } from "@workspace/database";
import {
  createRequestValidator,
  errorResponse,
  HandlerFunc,
  successResponse,
} from "route-action-gen/lib";
import { z } from "zod";

import {
  getDashboardSession,
  getDashboardSessionForRoute,
} from "@/lib/auth-dashboard";

const bodyValidator = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
});

export const requestValidator = createRequestValidator({
  body: bodyValidator,
  user: getDashboardSessionForRoute,
});

export const responseValidator = z.object({
  id: z.string().uuid(),
});

type CreateEntityTypeHandlerDependencies = {
  getSession?: typeof getDashboardSession;
  db?: typeof prisma;
};

type CreateEntityTypeHandler = HandlerFunc<
  typeof requestValidator,
  typeof responseValidator,
  undefined
>;

/**
 * Creates the create-entity-type handler with injectable dependencies for tests.
 *
 * @param dependencies - Optional getSession and db.
 * @returns Handler that creates an entity type and returns its id.
 */
export const createCreateEntityTypeHandler = ({
  getSession = getDashboardSession,
  db = prisma,
}: CreateEntityTypeHandlerDependencies = {}): CreateEntityTypeHandler => {
  return async (data) => {
    const session = await getSession();
    if (!session) {
      return errorResponse("Unauthorized");
    }

    const name = data.body.name.trim();
    const description = data.body.description?.trim() || null;
    const existing = await db.entityType.findUnique({ where: { name } });
    if (existing) {
      return errorResponse(`Entity type "${name}" already exists`);
    }

    const entityType = await db.entityType.create({
      data: { name, description },
    });

    return successResponse({ id: entityType.id });
  };
};

/**
 * Handles create entity type: validates session and creates entity type in DB.
 */
export const handler: CreateEntityTypeHandler = createCreateEntityTypeHandler();
