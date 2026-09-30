import {
  createRequestValidator,
  errorResponse,
  type HandlerFunc,
  successResponse,
} from "route-action-gen/lib";
import { z } from "zod";

import {
  deleteDomainRow,
  type DomainRowMutationResult,
} from "@/lib/domain-table-row-mutations";
import { requireMutationDashboardPrincipalForRoute } from "@/lib/require-mutation-dashboard-principal-for-route";
import { withDashboardRevalidation } from "@/lib/revalidate-dashboard";

const bodyValidator = z.object({
  integrationId: z.string().min(1),
  resource: z.string().min(1),
  id: z.string().min(1),
});

export const requestValidator = createRequestValidator({
  body: bodyValidator,
  user: requireMutationDashboardPrincipalForRoute,
});

export const responseValidator = z.custom<unknown>();

type DeleteDomainRowHandler = HandlerFunc<
  typeof requestValidator,
  typeof responseValidator,
  undefined
>;

export const createDeleteDomainRowHandler = ({
  deleteRow = deleteDomainRow,
}: {
  deleteRow?: (
    input: Parameters<typeof deleteDomainRow>[0],
  ) => Promise<DomainRowMutationResult>;
} = {}): DeleteDomainRowHandler => {
  return async (data) => {
    const result = await deleteRow({
      integrationId: data.body.integrationId,
      resource: data.body.resource,
      id: data.body.id,
    });

    return result.ok
      ? successResponse(result.data)
      : errorResponse(result.message, undefined, result.status);
  };
};

export const handler: DeleteDomainRowHandler = withDashboardRevalidation(
  createDeleteDomainRowHandler(),
);
