import {
  createRequestValidator,
  errorResponse,
  type HandlerFunc,
  successResponse,
} from "route-action-gen/lib";
import { z } from "zod";

import {
  runDomainTableCustomAction,
  type DomainRowMutationResult,
} from "@/lib/domain-table-row-mutations";
import { requireMutationDashboardPrincipalForRoute } from "@/lib/require-mutation-dashboard-principal-for-route";
import { withDashboardRevalidation } from "@/lib/revalidate-dashboard";

const bodyValidator = z.object({
  integrationId: z.string().min(1),
  resource: z.string().min(1),
  actionId: z.string().min(1),
  payloadJson: z.string().optional(),
});

export const requestValidator = createRequestValidator({
  body: bodyValidator,
  user: requireMutationDashboardPrincipalForRoute,
});

export const responseValidator = z.custom<unknown>();

type RunDomainCustomActionHandler = HandlerFunc<
  typeof requestValidator,
  typeof responseValidator,
  undefined
>;

export const createRunDomainCustomActionHandler = ({
  runAction = runDomainTableCustomAction,
}: {
  runAction?: (
    input: Parameters<typeof runDomainTableCustomAction>[0],
  ) => Promise<DomainRowMutationResult>;
} = {}): RunDomainCustomActionHandler => {
  return async (data) => {
    const result = await runAction({
      integrationId: data.body.integrationId,
      resource: data.body.resource,
      actionId: data.body.actionId,
      payloadJson: data.body.payloadJson,
    });

    return result.ok
      ? successResponse(result.data)
      : errorResponse(result.message, undefined, result.status);
  };
};

export const handler: RunDomainCustomActionHandler = withDashboardRevalidation(
  createRunDomainCustomActionHandler(),
);
