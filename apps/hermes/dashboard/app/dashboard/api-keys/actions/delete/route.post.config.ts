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

type DeleteApiKeyHandlerDependencies = {
  getSession?: typeof getDashboardSession;
  db?: typeof prisma;
};

type DeleteApiKeyHandler = HandlerFunc<
  typeof requestValidator,
  typeof responseValidator,
  undefined
>;

/**
 * Creates the delete-api-key handler with injectable dependencies for tests.
 *
 * @param dependencies - Optional getSession and db.
 * @returns Handler that deletes an API key by id.
 */
export const createDeleteApiKeyHandler = ({
  getSession = getDashboardSession,
  db = prisma,
}: DeleteApiKeyHandlerDependencies = {}): DeleteApiKeyHandler => {
  return async (data) => {
    const session = await getSession();
    if (!session) {
      return errorResponse("Unauthorized");
    }

    const { id } = data.body;

    await db.aPIKey.delete({
      where: { id },
    });

    return successResponse({ ok: true as const });
  };
};

/**
 * Handles delete API key: validates session and deletes by id.
 */
export const handler: DeleteApiKeyHandler = createDeleteApiKeyHandler();
