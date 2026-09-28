"use server";

import type { ActivityRow } from "@/components/use-agent-activity-modal";
import { getAgentActivities } from "@/lib/agent-activity";
import { getDashboardAdmin } from "@/lib/require-dashboard-admin";

/**
 * Loads agent activity rows for a job when the dashboard session is valid.
 *
 * @param jobId - Hermes job id for the invocation row.
 * @returns Activity rows or an empty list when unauthorized.
 */
export const fetchAgentActivitiesAction = async (
  jobId: string,
): Promise<ActivityRow[]> => {
  const admin = await getDashboardAdmin();
  if (!admin) {
    return [];
  }

  return getAgentActivities(jobId);
};
