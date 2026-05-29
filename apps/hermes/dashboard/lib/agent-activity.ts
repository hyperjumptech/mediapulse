import { prisma } from "@hermes/orchestration-database";

import type { ActivityRow } from "@/components/use-agent-activity-modal";

/**
 * Loads agent activity rows for a Hermes job directly from the orchestration database.
 *
 * @param jobId - Hermes job id to query.
 * @returns Activity rows ordered oldest first.
 */
export const getAgentActivities = async (
  jobId: string,
): Promise<ActivityRow[]> => {
  const rows = await prisma.agentActivity.findMany({
    where: { jobId },
    orderBy: { createdAt: "asc" },
  });

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    description: row.description,
    status: row.status as ActivityRow["status"],
    createdAt: row.createdAt.toISOString(),
  }));
};
