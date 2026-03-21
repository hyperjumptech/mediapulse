import { prisma } from "@workspace/orchestration-database";
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
  id: z.string().uuid(),
});

export const requestValidator = createRequestValidator({
  body: bodyValidator,
  user: getDashboardSessionForRoute,
});

export const responseValidator = z.object({
  ok: z.literal(true),
});

type DeleteRegisteredDatabaseHandlerDependencies = {
  getSession?: typeof getDashboardSession;
  db?: typeof prisma;
};

type DeleteRegisteredDatabaseHandler = HandlerFunc<
  typeof requestValidator,
  typeof responseValidator,
  undefined
>;

/**
 * Creates the delete-registered-database handler.
 *
 * @param dependencies - Optional dependencies for tests.
 * @returns Handler that deletes a registered DB by id.
 */
export const createDeleteRegisteredDatabaseHandler = ({
  getSession = getDashboardSession,
  db = prisma,
}: DeleteRegisteredDatabaseHandlerDependencies = {}): DeleteRegisteredDatabaseHandler => {
  return async (data) => {
    const session = await getSession();
    if (!session) {
      return errorResponse("Unauthorized");
    }

    await db.registeredDatabase.delete({
      where: { id: data.body.id },
    });

    return successResponse({ ok: true as const });
  };
};

export const handler: DeleteRegisteredDatabaseHandler =
  createDeleteRegisteredDatabaseHandler();
