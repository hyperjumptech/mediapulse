import {
  createRequestValidator,
  type HandlerFunc,
  successResponse,
} from "route-action-gen/lib";
import { z } from "zod";

import { createPendingDomainIntegration } from "@/lib/domain-integrations";
import { requireMutationDashboardPrincipalForRoute } from "@/lib/require-mutation-dashboard-principal-for-route";
import { withDashboardRevalidation } from "@/lib/revalidate-dashboard";

const bodyValidator = z.object({
  integrationId: z.string().trim().min(1, "Integration id is required"),
  name: z.string().trim().min(1, "Name is required"),
});

export const requestValidator = createRequestValidator({
  body: bodyValidator,
  user: requireMutationDashboardPrincipalForRoute,
});

export const responseValidator = z.object({
  id: z.guid(),
  integrationId: z.string(),
  name: z.string(),
  apiKeyPlaintext: z.string(),
});

type CreateDomainIntegrationHandler = HandlerFunc<
  typeof requestValidator,
  typeof responseValidator,
  undefined
>;

export const createCreateDomainIntegrationHandler = ({
  createPending = createPendingDomainIntegration,
}: {
  createPending?: (
    input: Parameters<typeof createPendingDomainIntegration>[0],
  ) => ReturnType<typeof createPendingDomainIntegration>;
} = {}): CreateDomainIntegrationHandler => {
  return async (data) => {
    const created = await createPending({
      integrationId: data.body.integrationId,
      name: data.body.name,
      userId: data.user.id,
    });

    return successResponse(created);
  };
};

export const handler: CreateDomainIntegrationHandler =
  withDashboardRevalidation(createCreateDomainIntegrationHandler());
