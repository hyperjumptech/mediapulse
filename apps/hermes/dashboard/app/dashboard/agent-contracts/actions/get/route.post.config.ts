import { prisma } from "@hermes/orchestration-database";
import {
  createRequestValidator,
  errorResponse,
  type HandlerFunc,
  successResponse,
} from "route-action-gen/lib";
import { z } from "zod";

import { getAgentContractById } from "@/lib/agent-contracts";
import { requireDashboardPrincipalForRoute } from "@/lib/auth-dashboard";

const bodyValidator = z.object({
  id: z.guid(),
});

export const requestValidator = createRequestValidator({
  body: bodyValidator,
  user: requireDashboardPrincipalForRoute,
});

type AgentContract = NonNullable<
  Awaited<ReturnType<typeof getAgentContractById>>
>;

export const responseValidator = z.custom<AgentContract>();

type GetAgentContractHandlerDependencies = {
  getById?: typeof getAgentContractById;
  db?: typeof prisma;
};

type GetAgentContractHandler = HandlerFunc<
  typeof requestValidator,
  typeof responseValidator,
  undefined
>;

export const createGetAgentContractHandler = ({
  getById = getAgentContractById,
  db = prisma,
}: GetAgentContractHandlerDependencies = {}): GetAgentContractHandler => {
  return async (data) => {
    const agentContract = await getById(data.body.id, db);
    if (!agentContract) {
      return errorResponse("Agent contract not found", undefined, 404);
    }

    return successResponse(agentContract);
  };
};

export const handler: GetAgentContractHandler = createGetAgentContractHandler();
