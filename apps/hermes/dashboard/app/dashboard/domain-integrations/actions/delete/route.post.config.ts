import { prisma } from "@hermes/orchestration-database";
import {
  createRequestValidator,
  errorResponse,
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

type DeleteDomainIntegrationHandlerDependencies = {
  db?: typeof prisma;
};

type DeleteDomainIntegrationHandler = HandlerFunc<
  typeof requestValidator,
  typeof responseValidator,
  undefined
>;

/**
 * Creates the delete-domain-integration handler with injectable dependencies.
 *
 * @param dependencies - Optional db client for tests.
 * @returns Handler that deletes a domain integration by id.
 */
export const createDeleteDomainIntegrationHandler = ({
  db = prisma,
}: DeleteDomainIntegrationHandlerDependencies = {}): DeleteDomainIntegrationHandler => {
  return async (data) => {
    const { id } = data.body;

    const pipelineCount = await db.pipeline.count({
      where: { domainIntegrationId: id },
    });
    if (pipelineCount > 0) {
      return errorResponse(
        "Cannot delete: one or more pipelines still use this domain integration. Reassign or remove those pipelines first.",
      );
    }

    await db.domainIntegration.delete({
      where: { id },
    });

    return successResponse({ ok: true as const });
  };
};

/**
 * Handles delete domain integration: validates session and deletes by id.
 */
export const handler: DeleteDomainIntegrationHandler =
  createDeleteDomainIntegrationHandler();
