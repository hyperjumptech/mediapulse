import { prisma } from "@workspace/mediapulse-database";
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
import { deleteDataSourceExpansion } from "@/lib/data-source-expansions";

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

type DeleteDataSourceExpansionHandlerDependencies = {
  getSession?: typeof getDashboardSession;
  db?: typeof prisma;
};

type DeleteDataSourceExpansionHandler = HandlerFunc<
  typeof requestValidator,
  typeof responseValidator,
  undefined
>;

/**
 * Creates the delete data source expansion handler with injectable dependencies for tests.
 *
 * @param dependencies - Optional getSession and db.
 * @returns Handler that deletes a data source expansion by id.
 */
export const createDeleteDataSourceExpansionHandler = ({
  getSession = getDashboardSession,
  db = prisma,
}: DeleteDataSourceExpansionHandlerDependencies = {}): DeleteDataSourceExpansionHandler => {
  return async (data) => {
    const session = await getSession();
    if (!session) {
      return errorResponse("Unauthorized");
    }

    const { id } = data.body;

    const deleted = await deleteDataSourceExpansion(id, db);
    if (!deleted) {
      return errorResponse("Data source expansion not found");
    }

    return successResponse({ ok: true as const });
  };
};

/**
 * Handles delete data source expansion: validates session and deletes by id.
 */
export const handler: DeleteDataSourceExpansionHandler =
  createDeleteDataSourceExpansionHandler();
