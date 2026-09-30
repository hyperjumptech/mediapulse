import {
  createRequestValidator,
  errorResponse,
  type HandlerFunc,
  successResponse,
} from "route-action-gen/lib";
import { z } from "zod";

import { getAgentDetailForApi } from "@/lib/agent-detail-api";
import { requireDashboardPrincipalForRoute } from "@/lib/auth-dashboard";

const bodyValidator = z.object({
  id: z.guid(),
});

export const requestValidator = createRequestValidator({
  body: bodyValidator,
  user: requireDashboardPrincipalForRoute,
});

type AgentDetailForApi = NonNullable<
  Awaited<ReturnType<typeof getAgentDetailForApi>>
>;

export const responseValidator = z.custom<AgentDetailForApi>();

type GetAgentHandler = HandlerFunc<
  typeof requestValidator,
  typeof responseValidator,
  undefined
>;

export const createGetAgentHandler = ({
  getDetail = getAgentDetailForApi,
}: {
  getDetail?: (id: string) => Promise<AgentDetailForApi | null>;
} = {}): GetAgentHandler => {
  return async (data) => {
    const agent = await getDetail(data.body.id);
    if (!agent) {
      return errorResponse("Agent not found", undefined, 404);
    }

    return successResponse(agent);
  };
};

export const handler: GetAgentHandler = createGetAgentHandler();
