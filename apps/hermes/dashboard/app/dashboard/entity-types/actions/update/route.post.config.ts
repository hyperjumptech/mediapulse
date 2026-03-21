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
  entityTypeId: z.string().uuid(),
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

type UpdateEntityTypeHandlerDependencies = {
  getSession?: typeof getDashboardSession;
  db?: typeof prisma;
};

type UpdateEntityTypeHandler = HandlerFunc<
  typeof requestValidator,
  typeof responseValidator,
  undefined
>;

/**
 * Creates the update-entity-type handler with injectable dependencies for tests.
 *
 * @param dependencies - Optional getSession and db.
 * @returns Handler that updates entity type name and description.
 */
export const createUpdateEntityTypeHandler = ({
  getSession = getDashboardSession,
  db = prisma,
}: UpdateEntityTypeHandlerDependencies = {}): UpdateEntityTypeHandler => {
  return async (data) => {
    const session = await getSession();
    if (!session) {
      return errorResponse("Unauthorized");
    }

    const { entityTypeId } = data.body;
    const name = data.body.name.trim();
    const description = data.body.description?.trim() || null;

    await db.entityType.update({
      where: { id: entityTypeId },
      data: { name, description },
    });

    return successResponse({ ok: true as const });
  };
};

/**
 * Handles update entity type: validates session and updates entity type in DB.
 */
export const handler: UpdateEntityTypeHandler = createUpdateEntityTypeHandler();
