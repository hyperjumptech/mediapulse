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
  relationTypeId: z.string().uuid(),
});

export const requestValidator = createRequestValidator({
  body: bodyValidator,
  user: getDashboardSessionForRoute,
});

export const responseValidator = z.object({
  ok: z.literal(true),
});

type DeleteRelationTypeHandlerDependencies = {
  getSession?: typeof getDashboardSession;
  db?: typeof prisma;
};

type DeleteRelationTypeHandler = HandlerFunc<
  typeof requestValidator,
  typeof responseValidator,
  undefined
>;

/**
 * Creates the delete-relation-type handler with injectable dependencies for tests.
 *
 * @param dependencies - Optional getSession and db.
 * @returns Handler that deletes a relation type when no entity relations reference it.
 */
export const createDeleteRelationTypeHandler = ({
  getSession = getDashboardSession,
  db = prisma,
}: DeleteRelationTypeHandlerDependencies = {}): DeleteRelationTypeHandler => {
  return async (data) => {
    const session = await getSession();
    if (!session) {
      return errorResponse("Unauthorized");
    }

    const { relationTypeId } = data.body;
    const inUseCount = await db.entityRelation.count({
      where: { relationTypeId },
    });
    if (inUseCount > 0) {
      return errorResponse(
        `Cannot delete: ${inUseCount} entity relations use this type`,
      );
    }

    await db.relationType.delete({
      where: { id: relationTypeId },
    });

    return successResponse({ ok: true as const });
  };
};

/**
 * Handles delete relation type: validates session, checks guard, and deletes by id.
 */
export const handler: DeleteRelationTypeHandler =
  createDeleteRelationTypeHandler();
