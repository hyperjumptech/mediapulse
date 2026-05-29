"use server";

import type { ActivityRow } from "@/components/use-agent-activity-modal";
import { getAgentActivities } from "@/lib/agent-activity";
import { getDashboardSession } from "@/lib/auth-dashboard";

/**
 * Loads agent activity rows for a job when the dashboard session is valid.
 *
 * @param jobId - Hermes job id for the invocation row.
 * @returns Activity rows or an empty list when unauthorized.
 */
export const fetchAgentActivitiesAction = async (
  jobId: string,
): Promise<ActivityRow[]> => {
  const session = await getDashboardSession();
  if (!session) {
    return [];
  }

  return getAgentActivities(jobId);
};
