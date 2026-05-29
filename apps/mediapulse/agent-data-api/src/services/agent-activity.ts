import { prisma as mediapulsePrisma } from "@mediapulse/database";
import type { Prisma } from "@mediapulse/database";

export type AgentActivityDb = {
  agentActivity: Pick<
    typeof mediapulsePrisma.agentActivity,
    "create" | "findMany"
  >;
};

/**
 * Inserts one agent activity row for a Hermes job.
 *
 * @param body - Validated POST body from an agent caller.
 * @param deps - Injectable database dependency (defaults to production Prisma client).
 * @returns The server-generated row id.
 */
export async function postAgentActivityService(
  body: {
    jobId: string;
    title: string;
    description?: string;
    status: string;
  },
  deps?: { db?: AgentActivityDb },
): Promise<{ id: string }> {
  const db = deps?.db ?? mediapulsePrisma;

  const createArgs = {
    data: {
      jobId: body.jobId,
      title: body.title,
      description: body.description ?? null,
      status: body.status,
    },
    select: { id: true },
  } satisfies Prisma.AgentActivityCreateArgs;

  return db.agentActivity.create(createArgs);
}

/**
 * Lists agent activity rows for a job, oldest first.
 *
 * @param jobId - Hermes job id to filter by.
 * @param deps - Injectable database dependency (defaults to production Prisma client).
 * @returns Matching rows ordered by `createdAt` ascending.
 */
export async function getAgentActivityService(
  jobId: string,
  deps?: { db?: AgentActivityDb },
) {
  const db = deps?.db ?? mediapulsePrisma;

  const findManyArgs = {
    where: { jobId },
    orderBy: { createdAt: "asc" as const },
  } satisfies Prisma.AgentActivityFindManyArgs;

  return db.agentActivity.findMany(findManyArgs);
}
