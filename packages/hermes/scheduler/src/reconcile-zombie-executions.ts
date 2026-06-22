import {
  type PrismaClient,
  ScheduleRunStatus,
} from "@hermes/orchestration-database";

import {
  areAllAgentJobsTerminal,
  countInvocationOutcomesFromTerminalJobs,
  resolveRunStatusFromTerminalJobs,
  type TerminalJobRow,
} from "./finalize-parent-from-terminal-jobs";

/** Logger shape for zombie execution reconciliation. */
export type ReconcileZombieExecutionsLogger = {
  info: (obj: Record<string, unknown>, msg: string) => void;
  warn: (obj: Record<string, unknown>, msg: string) => void;
};

export type ReconcileZombieExecutionsDeps = {
  db: PrismaClient;
  logger: ReconcileZombieExecutionsLogger;
};

type NonTerminalParentRow = {
  id: string;
  cancelledAt: Date | null;
};

/**
 * Finalizes one parent execution when all agent jobs are terminal but the parent is still non-terminal.
 *
 * @param db - Prisma client.
 * @param table - Parent execution table discriminator.
 * @param parent - Parent execution row id and optional cancel timestamp.
 * @param jobs - Agent jobs linked to the parent execution.
 * @returns True when the parent row was updated.
 */
const finalizeZombieParent = async (
  db: PrismaClient,
  table: "schedule" | "httpTrigger" | "manual",
  parent: NonTerminalParentRow,
  jobs: TerminalJobRow[],
): Promise<boolean> => {
  if (!areAllAgentJobsTerminal(jobs)) {
    return false;
  }

  const runStatus = resolveRunStatusFromTerminalJobs(jobs);
  const counts = countInvocationOutcomesFromTerminalJobs(jobs);
  const nonTerminalRunStatuses = [
    ScheduleRunStatus.pending,
    ScheduleRunStatus.running,
  ];

  if (table === "schedule") {
    const result = await db.scheduleExecution.updateMany({
      where: {
        id: parent.id,
        runStatus: { in: nonTerminalRunStatuses },
      },
      data: {
        runStatus,
        ...counts,
      },
    });
    return result.count > 0;
  }
  if (table === "httpTrigger") {
    const result = await db.httpTriggerExecution.updateMany({
      where: {
        id: parent.id,
        runStatus: { in: nonTerminalRunStatuses },
      },
      data: {
        runStatus,
        ...counts,
      },
    });
    return result.count > 0;
  }
  const result = await db.manualPipelineExecution.updateMany({
    where: {
      id: parent.id,
      runStatus: { in: nonTerminalRunStatuses },
    },
    data: {
      runStatus,
      ...counts,
    },
  });
  return result.count > 0;
};

/**
 * Finds parent executions stuck in pending/running while all linked agent jobs are already terminal.
 * Repairs legacy rows that predate step rollups or missed parent finalization during orphan cleanup.
 *
 * @param deps - Database client and logger.
 * @returns Number of parent executions finalized.
 */
export const reconcileZombieExecutions = async (
  deps: ReconcileZombieExecutionsDeps,
): Promise<number> => {
  const { db, logger } = deps;
  let finalized = 0;

  const scheduleParents = await db.scheduleExecution.findMany({
    where: {
      runStatus: {
        in: [ScheduleRunStatus.pending, ScheduleRunStatus.running],
      },
    },
    select: { id: true, cancelledAt: true },
  });

  for (const parent of scheduleParents) {
    const jobs = await db.agentJobExecution.findMany({
      where: { scheduleExecutionId: parent.id },
      select: { status: true, error: true },
    });
    const updated = await finalizeZombieParent(db, "schedule", parent, jobs);
    if (updated) {
      finalized++;
      logger.warn(
        {
          scheduleExecutionId: parent.id,
          runStatus: resolveRunStatusFromTerminalJobs(jobs),
        },
        "reconcile_zombie_executions: finalized schedule execution from terminal jobs",
      );
    }
  }

  const httpTriggerParents = await db.httpTriggerExecution.findMany({
    where: {
      runStatus: {
        in: [ScheduleRunStatus.pending, ScheduleRunStatus.running],
      },
    },
    select: { id: true, cancelledAt: true },
  });

  for (const parent of httpTriggerParents) {
    const jobs = await db.agentJobExecution.findMany({
      where: { httpTriggerExecutionId: parent.id },
      select: { status: true, error: true },
    });
    const updated = await finalizeZombieParent(db, "httpTrigger", parent, jobs);
    if (updated) {
      finalized++;
      logger.warn(
        {
          httpTriggerExecutionId: parent.id,
          runStatus: resolveRunStatusFromTerminalJobs(jobs),
        },
        "reconcile_zombie_executions: finalized HTTP trigger execution from terminal jobs",
      );
    }
  }

  const manualParents = await db.manualPipelineExecution.findMany({
    where: {
      runStatus: {
        in: [ScheduleRunStatus.pending, ScheduleRunStatus.running],
      },
    },
    select: { id: true, cancelledAt: true },
  });

  for (const parent of manualParents) {
    const jobs = await db.agentJobExecution.findMany({
      where: { manualExecutionId: parent.id },
      select: { status: true, error: true },
    });
    const updated = await finalizeZombieParent(db, "manual", parent, jobs);
    if (updated) {
      finalized++;
      logger.warn(
        {
          manualExecutionId: parent.id,
          runStatus: resolveRunStatusFromTerminalJobs(jobs),
        },
        "reconcile_zombie_executions: finalized manual pipeline execution from terminal jobs",
      );
    }
  }

  if (finalized > 0) {
    logger.info({ finalized }, "reconcile_zombie_executions: sweep complete");
  }

  return finalized;
};
