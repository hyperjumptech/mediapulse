import { prisma } from "@hermes/orchestration-database";
import {
  createRequestValidator,
  HandlerFunc,
  successResponse,
} from "route-action-gen/lib";
import { z } from "zod";

import { requireDashboardPrincipalForRoute } from "@/lib/auth-dashboard";

const bodyValidator = z.object({
  id: z.string().uuid(),
});

export const requestValidator = createRequestValidator({
  body: bodyValidator,
  user: requireDashboardPrincipalForRoute,
});

export const responseValidator = z.object({
  ok: z.literal(true),
});

type DeleteVariableHandlerDependencies = {
  db?: typeof prisma;
};

type DeleteVariableHandler = HandlerFunc<
  typeof requestValidator,
  typeof responseValidator,
  undefined
>;

/**
 * Creates the delete-variable handler with injectable dependencies for tests.
 *
 * @param dependencies - Optional db client for tests.
 * @returns Handler that deletes a variable by id.
 */
export const createDeleteVariableHandler = ({
  db = prisma,
}: DeleteVariableHandlerDependencies = {}): DeleteVariableHandler => {
  return async (data) => {
    const { id } = data.body;

    await db.variable.delete({
      where: { id },
    });

    return successResponse({ ok: true as const });
  };
};

/**
 * Handles delete variable: validates session and deletes by id.
 */
export const handler: DeleteVariableHandler = createDeleteVariableHandler();
