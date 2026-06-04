import { prisma } from "@hermes/orchestration-database";
import {
  createRequestValidator,
  HandlerFunc,
  successResponse,
} from "route-action-gen/lib";
import { z } from "zod";

import { requireMutationDashboardPrincipalForRoute } from "@/lib/require-mutation-dashboard-principal-for-route";

const bodyValidator = z.object({
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

type CreateAgentContractHandlerDependencies = {
  db?: typeof prisma;
};

type CreateAgentContractHandler = HandlerFunc<
  typeof requestValidator,
  typeof responseValidator,
  undefined
>;

export const createCreateAgentContractHandler = ({
  db = prisma,
}: CreateAgentContractHandlerDependencies = {}): CreateAgentContractHandler => {
  return async (data) => {
    const userId = data.user.id;
    const { name, description, brief, version } = data.body;

    const created = await db.agentContract.create({
      data: {
        name,
        description: description ?? null,
        brief,
        version,
        createdById: userId,
      },
    });

    return successResponse({ id: created.id });
  };
};

export const handler: CreateAgentContractHandler =
  createCreateAgentContractHandler();
