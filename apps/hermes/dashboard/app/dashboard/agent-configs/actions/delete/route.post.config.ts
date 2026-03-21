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

type DeleteAgentConfigHandlerDependencies = {
  getSession?: typeof getDashboardSession;
  db?: typeof prisma;
};

type DeleteAgentConfigHandler = HandlerFunc<
  typeof requestValidator,
  typeof responseValidator,
  undefined
>;

/**
 * Creates the delete-agent-config handler with injectable dependencies for tests.
 * Forbids delete if any pipeline step references this config.
 *
 * @param dependencies - Optional getSession and db.
 * @returns Handler that deletes an agent config when not in use.
 */
export const createDeleteAgentConfigHandler = ({
  getSession = getDashboardSession,
  db = prisma,
}: DeleteAgentConfigHandlerDependencies = {}): DeleteAgentConfigHandler => {
  return async (data) => {
    const session = await getSession();
    if (!session) {
      return errorResponse("Unauthorized");
    }

    const { id } = data.body;

    const inUse = await db.pipelineStep.count({
      where: { agentConfigId: id },
    });
    if (inUse > 0) {
      return errorResponse(
        "Cannot delete: this config is assigned to one or more pipeline steps. Remove it from those steps first.",
      );
    }

    await db.agentConfig.delete({
      where: { id },
    });

    return successResponse({ ok: true as const });
  };
};

/**
 * Handles delete agent config: forbids if in use by any step.
 */
export const handler: DeleteAgentConfigHandler =
  createDeleteAgentConfigHandler();
