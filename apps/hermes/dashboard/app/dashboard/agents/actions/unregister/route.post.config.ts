import { prisma } from "@hermes/orchestration-database";
import {
  createRequestValidator,
  HandlerFunc,
  successResponse,
} from "route-action-gen/lib";
import { z } from "zod";

import { requireMutationDashboardPrincipalForRoute } from "@/lib/require-mutation-dashboard-principal-for-route";

const bodyValidator = z.object({
  id: z.string().uuid(),
});

export const requestValidator = createRequestValidator({
  body: bodyValidator,
  user: requireMutationDashboardPrincipalForRoute,
});

export const responseValidator = z.object({
  ok: z.literal(true),
});

type UnregisterAgentHandlerDependencies = {
  db?: typeof prisma;
};

type UnregisterAgentHandler = HandlerFunc<
  typeof requestValidator,
  typeof responseValidator,
  undefined
>;

/**
 * Creates the unregister-agent handler with injectable dependencies for tests.
 *
 * Removes the agent's registry entry from the shared orchestration database (the registry's data
 * store). The agent-registry-api also exposes `POST /api/agents/unregister` for agent/operator use.
 *
 * @param dependencies - Optional db client for tests.
 * @returns Handler that unregisters an agent registry entry.
 */
export const createUnregisterAgentHandler = ({
  db = prisma,
}: UnregisterAgentHandlerDependencies = {}): UnregisterAgentHandler => {
  return async (data) => {
    const { id } = data.body;

    await db.agentRegistry.delete({
      where: { id },
    });

    return successResponse({ ok: true as const });
  };
};

/**
 * Handles unregister agent: validates session and removes the agent registry entry.
 */
export const handler: UnregisterAgentHandler = createUnregisterAgentHandler();
