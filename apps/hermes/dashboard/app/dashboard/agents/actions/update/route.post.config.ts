import { prisma, Prisma } from "@hermes/orchestration-database";
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
 * Parses optional JSON string into a plain object for endpoint. Rejects arrays and non-object values.
 */
const endpointSchema = z
  .string()
  .optional()
  .transform((s): Record<string, unknown> | undefined => {
    if (s === undefined || s === "") return undefined;
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
  id: z.string().uuid(),
  agentId: z.string().min(1).optional(),
  agentVersion: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  endpoint: endpointSchema,
  isActive: z
    .union([z.boolean(), z.literal("true"), z.literal("false")])
    .optional()
    .transform((v): boolean | undefined =>
      v === undefined ? undefined : v === true || v === "true",
    ),
});

export const requestValidator = createRequestValidator({
  body: bodyValidator,
  user: getDashboardSessionForRoute,
});

export const responseValidator = z.object({
  ok: z.literal(true),
});

type UpdateAgentHandlerDependencies = {
  getSession?: typeof getDashboardSession;
  db?: typeof prisma;
};

type UpdateAgentHandler = HandlerFunc<
  typeof requestValidator,
  typeof responseValidator,
  undefined
>;

/**
 * Creates the update-agent handler with injectable dependencies for tests.
 *
 * @param dependencies - Optional getSession and db.
 * @returns Handler that updates an agent registry entry.
 */
export const createUpdateAgentHandler = ({
  getSession = getDashboardSession,
  db = prisma,
}: UpdateAgentHandlerDependencies = {}): UpdateAgentHandler => {
  return async (data) => {
    const session = await getSession();
    if (!session) {
      return errorResponse("Unauthorized");
    }

    const { id, agentId, agentVersion, description, endpoint, isActive } =
      data.body;

    if (agentId !== undefined || agentVersion !== undefined) {
      const current = await db.agentRegistry.findUnique({
        where: { id },
      });
      if (!current) {
        return errorResponse("Agent not found");
      }
      const newAgentId = agentId ?? current.agentId;
      const newAgentVersion = agentVersion ?? current.agentVersion;
      if (
        newAgentId !== current.agentId ||
        newAgentVersion !== current.agentVersion
      ) {
        const existing = await db.agentRegistry.findUnique({
          where: {
            domainIntegrationId_agentId_agentVersion: {
              domainIntegrationId: current.domainIntegrationId,
              agentId: newAgentId,
              agentVersion: newAgentVersion,
            },
          },
        });
        if (existing && existing.id !== id) {
          return errorResponse(
            `Agent "${newAgentId}" version "${newAgentVersion}" already exists.`,
          );
        }
      }
    }

    const updateData: Parameters<typeof db.agentRegistry.update>[0]["data"] =
      {};
    if (agentId !== undefined) updateData.agentId = agentId;
    if (agentVersion !== undefined) updateData.agentVersion = agentVersion;
    if (description !== undefined)
      updateData.description = description === null ? null : description;
    if (endpoint !== undefined)
      updateData.endpoint = endpoint as Prisma.InputJsonValue;
    if (isActive !== undefined) updateData.isActive = isActive;

    await db.agentRegistry.update({
      where: { id },
      data: updateData,
    });

    return successResponse({ ok: true as const });
  };
};

/**
 * Handles update agent: validates session and updates agent in DB.
 */
export const handler: UpdateAgentHandler = createUpdateAgentHandler();
