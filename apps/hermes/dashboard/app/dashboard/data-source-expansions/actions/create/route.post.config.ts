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
import { createDataSourceExpansion } from "@/lib/data-source-expansions";

const bodyValidator = z.object({
  name: z.string().min(1, "Name is required"),
  expansionString: z.string().min(1, "Expansion string is required"),
  description: z.string().optional(),
});

export const requestValidator = createRequestValidator({
  body: bodyValidator,
  user: getDashboardSessionForRoute,
});

export const responseValidator = z.object({
  id: z.string().uuid(),
});

type CreateDataSourceExpansionHandlerDependencies = {
  getSession?: typeof getDashboardSession;
  db?: typeof prisma;
};

type CreateDataSourceExpansionHandler = HandlerFunc<
  typeof requestValidator,
  typeof responseValidator,
  undefined
>;

/**
 * Creates the create data source expansion handler with injectable dependencies for tests.
 *
 * @param dependencies - Optional getSession and db.
 * @returns Handler that creates a data source expansion (name, expansionString, description).
 */
export const createCreateDataSourceExpansionHandler = ({
  getSession = getDashboardSession,
  db = prisma,
}: CreateDataSourceExpansionHandlerDependencies = {}): CreateDataSourceExpansionHandler => {
  return async (data) => {
    const session = await getSession();
    if (!session) {
      return errorResponse("Unauthorized");
    }

    const { name, expansionString, description } = data.body;

    const created = await createDataSourceExpansion(
      { name, expansionString, description, createdById: session.id },
      db,
    );

    return successResponse({ id: created.id });
  };
};

/**
 * Handles create data source expansion: validates session and creates expansion.
 */
export const handler: CreateDataSourceExpansionHandler =
  createCreateDataSourceExpansionHandler();
