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
  relationTypeId: z.string().uuid(),
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
});

export const requestValidator = createRequestValidator({
  body: bodyValidator,
  user: getDashboardSessionForRoute,
});

export const responseValidator = z.object({
  ok: z.literal(true),
});

type UpdateRelationTypeHandlerDependencies = {
  getSession?: typeof getDashboardSession;
  db?: typeof prisma;
};

type UpdateRelationTypeHandler = HandlerFunc<
  typeof requestValidator,
  typeof responseValidator,
  undefined
>;

/**
 * Creates the update-relation-type handler with injectable dependencies for tests.
 *
 * @param dependencies - Optional getSession and db.
 * @returns Handler that updates relation type name and description.
 */
export const createUpdateRelationTypeHandler = ({
  getSession = getDashboardSession,
  db = prisma,
}: UpdateRelationTypeHandlerDependencies = {}): UpdateRelationTypeHandler => {
  return async (data) => {
    const session = await getSession();
    if (!session) {
      return errorResponse("Unauthorized");
    }

    const { relationTypeId } = data.body;
    const name = data.body.name.trim();
    const description = data.body.description?.trim() || null;

    await db.relationType.update({
      where: { id: relationTypeId },
      data: { name, description },
    });

    return successResponse({ ok: true as const });
  };
};

/**
 * Handles update relation type: validates session and updates relation type in DB.
 */
export const handler: UpdateRelationTypeHandler =
  createUpdateRelationTypeHandler();
