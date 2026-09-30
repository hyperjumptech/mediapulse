import {
  createRequestValidator,
  errorResponse,
  type HandlerFunc,
  successResponse,
} from "route-action-gen/lib";
import { z } from "zod";

import {
  updateDomainRow,
  type DomainRowMutationResult,
} from "@/lib/domain-table-row-mutations";
import { requireMutationDashboardPrincipalForRoute } from "@/lib/require-mutation-dashboard-principal-for-route";
import { withDashboardRevalidation } from "@/lib/revalidate-dashboard";

const bodyValidator = z.object({
  integrationId: z.string().min(1),
  resource: z.string().min(1),
  id: z.string().min(1),
  values: z.record(z.string(), z.unknown()),
});

export const requestValidator = createRequestValidator({
  body: bodyValidator,
  user: requireMutationDashboardPrincipalForRoute,
});

export const responseValidator = z.custom<unknown>();

type UpdateDomainRowHandler = HandlerFunc<
  typeof requestValidator,
  typeof responseValidator,
  undefined
>;

export const createUpdateDomainRowHandler = ({
  updateRow = updateDomainRow,
}: {
  updateRow?: (
    input: Parameters<typeof updateDomainRow>[0],
  ) => Promise<DomainRowMutationResult>;
} = {}): UpdateDomainRowHandler => {
  return async (data) => {
    const result = await updateRow({
      integrationId: data.body.integrationId,
      resource: data.body.resource,
      id: data.body.id,
      values: data.body.values,
    });

    return result.ok
      ? successResponse(result.data)
      : errorResponse(result.message, undefined, result.status);
  };
};

export const handler: UpdateDomainRowHandler = withDashboardRevalidation(
  createUpdateDomainRowHandler(),
);
