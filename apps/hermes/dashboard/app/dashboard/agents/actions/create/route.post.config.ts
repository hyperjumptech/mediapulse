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

/**
 * Parses JSON string into a plain object for endpoint. Rejects arrays and non-object values.
 */
const endpointSchema = z.string().transform((s): Record<string, unknown> => {
  try {
    const v = JSON.parse(s) as unknown;
    if (v !== null && typeof v === "object" && !Array.isArray(v)) {
      return v as Record<string, unknown>;
    }
    throw new Error("Endpoint must be a JSON object");
  } catch (err) {
    throw err instanceof Error ? err : new Error("Invalid JSON in endpoint");
  }
});

const bodyValidator = z.object({
  agentId: z.string().min(1, "Agent ID is required"),
  agentVersion: z.string().min(1, "Agent version is required"),
  description: z.string().optional(),
  endpoint: endpointSchema,
  isActive: z
    .union([z.boolean(), z.literal("true"), z.literal("false")])
    .optional()
    .default(false)
    .transform((v) => v === true || v === "true"),
});

export const requestValidator = createRequestValidator({
  body: bodyValidator,
  user: getDashboardSessionForRoute,
});

export const responseValidator = z.object({
  id: z.string().uuid(),
});

type CreateAgentHandlerDependencies = {
  getSession?: typeof getDashboardSession;
  db?: typeof prisma;
};

type CreateAgentHandler = HandlerFunc<
  typeof requestValidator,
  typeof responseValidator,
  undefined
>;

/**
 * Creates the create-agent handler with injectable dependencies for tests.
 *
 * @param dependencies - Optional getSession and db.
 * @returns Handler that creates a single agent registry entry and returns its id.
 */
export const createCreateAgentHandler = ({
  getSession = getDashboardSession,
  db = prisma,
}: CreateAgentHandlerDependencies = {}): CreateAgentHandler => {
  return async (data) => {
    const session = await getSession();
    if (!session) {
      return errorResponse("Unauthorized");
    }

    const { agentId, agentVersion, description, endpoint, isActive } =
      data.body;

    const existing = await db.agentRegistry.findUnique({
      where: {
        agentId_agentVersion: { agentId, agentVersion },
      },
    });
    if (existing) {
      return errorResponse(
        `Agent "${agentId}" version "${agentVersion}" already exists.`,
      );
    }

    const agent = await db.agentRegistry.create({
      data: {
        agentId,
        agentVersion,
        description: description ?? null,
        endpoint: endpoint as Parameters<
          typeof db.agentRegistry.create
        >[0]["data"]["endpoint"],
        isActive,
      },
    });

    return successResponse({ id: agent.id });
  };
};

/**
 * Handles create agent: validates session and creates agent in DB.
 */
export const handler: CreateAgentHandler = createCreateAgentHandler();
