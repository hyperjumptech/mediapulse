import { prisma } from "@mediapulse/database";
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

type CreateRelationTypeHandlerDependencies = {
  getSession?: typeof getDashboardSession;
  db?: typeof prisma;
};

type CreateRelationTypeHandler = HandlerFunc<
  typeof requestValidator,
  typeof responseValidator,
  undefined
>;

/**
 * Creates the create-relation-type handler with injectable dependencies for tests.
 *
 * @param dependencies - Optional getSession and db.
 * @returns Handler that creates a relation type and returns its id.
 */
export const createCreateRelationTypeHandler = ({
  getSession = getDashboardSession,
  db = prisma,
}: CreateRelationTypeHandlerDependencies = {}): CreateRelationTypeHandler => {
  return async (data) => {
    const session = await getSession();
    if (!session) {
      return errorResponse("Unauthorized");
    }

    const name = data.body.name.trim();
    const description = data.body.description?.trim() || null;
    const existing = await db.relationType.findUnique({ where: { name } });
    if (existing) {
      return errorResponse(`Relation type "${name}" already exists`);
    }

    const relationType = await db.relationType.create({
      data: { name, description },
    });

    return successResponse({ id: relationType.id });
  };
};

/**
 * Handles create relation type: validates session and creates relation type in DB.
 */
export const handler: CreateRelationTypeHandler =
  createCreateRelationTypeHandler();
