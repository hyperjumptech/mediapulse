import {
  createRequestValidator,
  type HandlerFunc,
  successResponse,
} from "route-action-gen/lib";
import { z } from "zod";

import type { ActivityRow } from "@/components/use-agent-activity-modal";
import { getAgentActivities } from "@/lib/agent-activity";
import { requireDashboardPrincipalForRoute } from "@/lib/auth-dashboard";

const bodyValidator = z.object({
  jobId: z.string().min(1),
});

export const requestValidator = createRequestValidator({
  body: bodyValidator,
  user: requireDashboardPrincipalForRoute,
});

export const responseValidator = z.custom<{ activities: ActivityRow[] }>();

type GetAgentActivitiesHandler = HandlerFunc<
  typeof requestValidator,
  typeof responseValidator,
  undefined
>;

export const createGetAgentActivitiesHandler = ({
  getActivities = getAgentActivities,
}: {
  getActivities?: typeof getAgentActivities;
} = {}): GetAgentActivitiesHandler => {
  return async (data) => {
    const activities = await getActivities(data.body.jobId);

    return successResponse({ activities });
  };
};

export const handler: GetAgentActivitiesHandler =
  createGetAgentActivitiesHandler();
