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
import { updateDataSourceExpansion } from "@/lib/data-source-expansions";

const bodyValidator = z.object({
  id: z.string().uuid(),
  name: z.string().min(1, "Name is required"),
  expansionString: z.string().min(1, "Expansion string is required"),
  description: z.string().optional().nullable(),
});

export const requestValidator = createRequestValidator({
  body: bodyValidator,
  user: getDashboardSessionForRoute,
});

export const responseValidator = z.object({
  ok: z.literal(true),
});

type UpdateDataSourceExpansionHandlerDependencies = {
  getSession?: typeof getDashboardSession;
  db?: typeof prisma;
};

type UpdateDataSourceExpansionHandler = HandlerFunc<
  typeof requestValidator,
  typeof responseValidator,
  undefined
>;

/**
 * Creates the update data source expansion handler with injectable dependencies for tests.
 *
 * @param dependencies - Optional getSession and db.
 * @returns Handler that updates a data source expansion by id.
 */
export const createUpdateDataSourceExpansionHandler = ({
  getSession = getDashboardSession,
  db = prisma,
}: UpdateDataSourceExpansionHandlerDependencies = {}): UpdateDataSourceExpansionHandler => {
  return async (data) => {
    const session = await getSession();
    if (!session) {
      return errorResponse("Unauthorized");
    }

    const { id, name, expansionString, description } = data.body;

    const updated = await updateDataSourceExpansion(
      id,
      { name, expansionString, description },
      db,
    );

    if (!updated) {
      return errorResponse("Data source expansion not found");
    }

    return successResponse({ ok: true as const });
  };
};

/**
 * Handles update data source expansion: validates session and updates by id.
 */
export const handler: UpdateDataSourceExpansionHandler =
  createUpdateDataSourceExpansionHandler();
