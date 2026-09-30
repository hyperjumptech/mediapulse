import { prisma, Prisma } from "@hermes/orchestration-database";
import {
  createRequestValidator,
  errorResponse,
  HandlerFunc,
  successResponse,
} from "route-action-gen/lib";
import { z } from "zod";

import { optionalJsonObjectFieldSchema } from "@/lib/json-object-field-schema";
import { requireMutationDashboardPrincipalForRoute } from "@/lib/require-mutation-dashboard-principal-for-route";
import { withDashboardRevalidation } from "@/lib/revalidate-dashboard";

const bodyValidator = z.object({
  id: z.guid(),
  agentId: z.string().min(1).optional(),
  agentVersion: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  endpoint: optionalJsonObjectFieldSchema("Endpoint"),
  isActive: z
    .union([z.boolean(), z.literal("true"), z.literal("false")])
    .optional()
    .transform((v): boolean | undefined =>
      v === undefined ? undefined : v === true || v === "true",
    ),
});

export const requestValidator = createRequestValidator({
  body: bodyValidator,
  user: requireMutationDashboardPrincipalForRoute,
});

export const responseValidator = z.object({
  ok: z.literal(true),
});

type UpdateAgentHandlerDependencies = {
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
 * @param dependencies - Optional db client for tests.
 * @returns Handler that updates an agent registry entry.
 */
export const createUpdateAgentHandler = ({
  db = prisma,
}: UpdateAgentHandlerDependencies = {}): UpdateAgentHandler => {
  return async (data) => {
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
export const handler: UpdateAgentHandler = withDashboardRevalidation(
  createUpdateAgentHandler(),
);
