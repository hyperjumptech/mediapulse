import { prisma } from "@hermes/orchestration-database";
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
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  agentId: z.string(),
  agentVersion: z.string(),
  config: z.record(z.unknown()),
  configSchemaFingerprint: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

type GetAgentConfigHandlerDependencies = {
  getSession?: typeof getDashboardSession;
  db?: typeof prisma;
};

type GetAgentConfigHandler = HandlerFunc<
  typeof requestValidator,
  typeof responseValidator,
  undefined
>;

/**
 * Creates the get-agent-config handler with injectable dependencies for tests.
 *
 * @param dependencies - Optional getSession and db.
 * @returns Handler that returns a single agent config by id.
 */
export const createGetAgentConfigHandler = ({
  getSession = getDashboardSession,
  db = prisma,
}: GetAgentConfigHandlerDependencies = {}): GetAgentConfigHandler => {
  return async (data) => {
    const session = await getSession();
    if (!session) {
      return errorResponse("Unauthorized");
    }

    const { id } = data.body;

    const config = await db.agentConfig.findUnique({
      where: { id },
    });
    if (!config) {
      return errorResponse("Agent config not found");
    }

    return successResponse({
      id: config.id,
      name: config.name,
      description: config.description,
      agentId: config.agentId,
      agentVersion: config.agentVersion,
      config: config.config as Record<string, unknown>,
      configSchemaFingerprint: config.configSchemaFingerprint,
      createdAt: config.createdAt,
      updatedAt: config.updatedAt,
    });
  };
};

/**
 * Handles get agent config by id (for edit/duplicate).
 */
export const handler: GetAgentConfigHandler = createGetAgentConfigHandler();
