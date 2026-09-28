import type { Prisma } from "@hermes/orchestration-database";
import { prisma } from "@hermes/orchestration-database";

export type ProcessedUrlsExecution = {
  integrationId: string;
  agentIds: string[];
};

type ScheduleExecutionReader = Pick<
  typeof prisma.scheduleExecution,
  "findFirst"
>;

const processedUrlsExecutionSelect = {
  schedule: {
    select: {
      pipeline: {
        select: {
          domainIntegration: { select: { integrationId: true } },
        },
      },
    },
  },
  agentJobExecutions: {
    select: { agentId: true },
    distinct: ["agentId"],
    orderBy: { agentId: "asc" },
  },
} satisfies Prisma.ScheduleExecutionSelect;

export const loadProcessedUrlsExecution = async (
  scheduleId: string,
  executionId: string,
  db: ScheduleExecutionReader = prisma.scheduleExecution,
): Promise<ProcessedUrlsExecution | null> => {
  const executionQuery = {
    where: { id: executionId, scheduleId },
    select: processedUrlsExecutionSelect,
  } satisfies Prisma.ScheduleExecutionFindFirstArgs;
  const row = await db.findFirst(executionQuery);
  if (!row) {
    return null;
  }

  const integrationId = row.schedule.pipeline.domainIntegration.integrationId;
  const agentIds = row.agentJobExecutions.map((job) => job.agentId);

  return { integrationId, agentIds };
};
