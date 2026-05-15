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

type DeleteAgentHandlerDependencies = {
  db?: typeof prisma;
};

type DeleteAgentHandler = HandlerFunc<
  typeof requestValidator,
  typeof responseValidator,
  undefined
>;

/**
 * Creates the delete-agent handler with injectable dependencies for tests.
 *
 * @param dependencies - Optional db client for tests.
 * @returns Handler that deletes an agent registry entry.
 */
export const createDeleteAgentHandler = ({
  db = prisma,
}: DeleteAgentHandlerDependencies = {}): DeleteAgentHandler => {
  return async (data) => {
    const { id } = data.body;

    await db.agentRegistry.delete({
      where: { id },
    });

    return successResponse({ ok: true as const });
  };
};

/**
 * Handles delete agent: validates session and deletes agent from DB.
 */
export const handler: DeleteAgentHandler = createDeleteAgentHandler();
