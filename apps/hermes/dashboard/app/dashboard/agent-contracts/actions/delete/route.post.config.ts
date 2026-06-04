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
});

export const requestValidator = createRequestValidator({
  body: bodyValidator,
  user: requireMutationDashboardPrincipalForRoute,
});

export const responseValidator = z.object({
  ok: z.literal(true),
});

type DeleteAgentContractHandlerDependencies = {
  db?: typeof prisma;
};

type DeleteAgentContractHandler = HandlerFunc<
  typeof requestValidator,
  typeof responseValidator,
  undefined
>;

export const createDeleteAgentContractHandler = ({
  db = prisma,
}: DeleteAgentContractHandlerDependencies = {}): DeleteAgentContractHandler => {
  return async (data) => {
    const { id } = data.body;

    const inUse = await db.pipelineStep.count({
      where: { agentContractId: id },
    });
    if (inUse > 0) {
      return errorResponse(
        "Cannot delete: this contract is assigned to one or more pipeline steps. Remove it from those steps first.",
      );
    }

    await db.agentContract.delete({ where: { id } });

    return successResponse({ ok: true as const });
  };
};

export const handler: DeleteAgentContractHandler =
  createDeleteAgentContractHandler();
