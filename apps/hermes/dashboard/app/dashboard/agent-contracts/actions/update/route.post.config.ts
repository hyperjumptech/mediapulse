import { prisma } from "@hermes/orchestration-database";
import {
  createRequestValidator,
  errorResponse,
  HandlerFunc,
  successResponse,
} from "route-action-gen/lib";
import { z } from "zod";

import { requireMutationDashboardPrincipalForRoute } from "@/lib/require-mutation-dashboard-principal-for-route";

const bodyValidator = z.object({
  id: z.string().uuid(),
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  brief: z.string().min(1, "Brief is required"),
  version: z.string().min(1, "Version is required"),
});

export const requestValidator = createRequestValidator({
  body: bodyValidator,
  user: requireMutationDashboardPrincipalForRoute,
});

export const responseValidator = z.object({
  id: z.string().uuid(),
});

type UpdateAgentContractHandlerDependencies = {
  db?: typeof prisma;
};

type UpdateAgentContractHandler = HandlerFunc<
  typeof requestValidator,
  typeof responseValidator,
  undefined
>;

export const createUpdateAgentContractHandler = ({
  db = prisma,
}: UpdateAgentContractHandlerDependencies = {}): UpdateAgentContractHandler => {
  return async (data) => {
    const { id, name, description, brief, version } = data.body;

    const existing = await db.agentContract.findUnique({ where: { id } });
    if (!existing) {
      return errorResponse("Agent contract not found");
    }

    const updated = await db.agentContract.update({
      where: { id },
      data: { name, description: description ?? null, brief, version },
    });

    return successResponse({ id: updated.id });
  };
};

export const handler: UpdateAgentContractHandler =
  createUpdateAgentContractHandler();
