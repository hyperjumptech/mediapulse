import {
  createRequestValidator,
  errorResponse,
  type HandlerFunc,
  successResponse,
} from "route-action-gen/lib";
import { z } from "zod";

import { requireDashboardPrincipalForRoute } from "@/lib/auth-dashboard";
import {
  getInvocationPayload,
  invocationPayloadRequestSchema,
  type InvocationPayload,
} from "@/lib/invocation-payload";

export const requestValidator = createRequestValidator({
  body: invocationPayloadRequestSchema,
  user: requireDashboardPrincipalForRoute,
});

export const responseValidator = z.custom<InvocationPayload>();

type GetInvocationHandler = HandlerFunc<
  typeof requestValidator,
  typeof responseValidator,
  undefined
>;

export const createGetInvocationHandler = ({
  getPayload = getInvocationPayload,
}: {
  getPayload?: typeof getInvocationPayload;
} = {}): GetInvocationHandler => {
  return async (data) => {
    const payload = await getPayload(data.body);
    if (!payload) {
      return errorResponse("Invocation not found", undefined, 404);
    }

    return successResponse(payload);
  };
};

export const handler: GetInvocationHandler = createGetInvocationHandler();
