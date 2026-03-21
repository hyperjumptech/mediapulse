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
  entityTypeId: z.string().uuid(),
});

export const requestValidator = createRequestValidator({
  body: bodyValidator,
  user: getDashboardSessionForRoute,
});

export const responseValidator = z.object({
  ok: z.literal(true),
});

type DeleteEntityTypeHandlerDependencies = {
  getSession?: typeof getDashboardSession;
  db?: typeof prisma;
};

type DeleteEntityTypeHandler = HandlerFunc<
  typeof requestValidator,
  typeof responseValidator,
  undefined
>;

/**
 * Creates the delete-entity-type handler with injectable dependencies for tests.
 *
 * @param dependencies - Optional getSession and db.
 * @returns Handler that deletes an entity type when no entities reference it.
 */
export const createDeleteEntityTypeHandler = ({
  getSession = getDashboardSession,
  db = prisma,
}: DeleteEntityTypeHandlerDependencies = {}): DeleteEntityTypeHandler => {
  return async (data) => {
    const session = await getSession();
    if (!session) {
      return errorResponse("Unauthorized");
    }

    const { entityTypeId } = data.body;
    const inUseCount = await db.entity.count({
      where: { typeId: entityTypeId },
    });
    if (inUseCount > 0) {
      return errorResponse(
        `Cannot delete: ${inUseCount} entities use this type`,
      );
    }

    await db.entityType.delete({
      where: { id: entityTypeId },
    });

    return successResponse({ ok: true as const });
  };
};

/**
 * Handles delete entity type: validates session, checks guard, and deletes by id.
 */
export const handler: DeleteEntityTypeHandler = createDeleteEntityTypeHandler();
