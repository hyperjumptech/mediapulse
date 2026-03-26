import {
  AgentJobExecutionStatus,
  prisma,
  ScheduleRunStatus,
  ScheduleStepRollupStatus,
} from "@hermes/orchestration-database";

import { getHermesJobQueue } from "@/lib/hermes-job-queue";

export type ExecutionSource = "schedule" | "http-trigger" | "manual";

type CancelExecutionDb = typeof prisma;
type CancelExecutionQueue = Pick<
  ReturnType<typeof getHermesJobQueue>,
  "cancelAllUpcomingJobs"
>;

export type CancelExecutionResult =
  | {
      kind: "not_found";
    }
  | {
      kind: "already_terminal";
      runStatus: ScheduleRunStatus;
    }
  | {
      kind: "cancelled";
      runStatus: ScheduleRunStatus;
    };

type CancelExecutionDeps = {
  db?: CancelExecutionDb;
  queue?: CancelExecutionQueue;
  now?: () => Date;
};

const cancellableRunStatuses = [
  ScheduleRunStatus.pending,
  ScheduleRunStatus.running,
] as const;

const cancellableInvocationStatuses = [
  AgentJobExecutionStatus.pending,
  AgentJobExecutionStatus.running,
] as const;

const cancellableStepRollupStatuses = [
  ScheduleStepRollupStatus.pending,
  ScheduleStepRollupStatus.running,
] as const;

/**
 * Checks whether an execution run status can still be cancelled.
 *
 * @param runStatus - Current execution run status.
 * @returns True when status is pending or running.
 */
const isCancellableRunStatus = (runStatus: ScheduleRunStatus): boolean =>
  runStatus === ScheduleRunStatus.pending ||
  runStatus === ScheduleRunStatus.running;

/**
 * Resolves the DataQueue tag used to cancel upcoming jobs for one execution.
 *
 * @param source - Execution source type.
 * @param executionId - Execution row id.
 * @returns Queue tag that correlates to the execution.
 */
const getExecutionTag = (
  source: ExecutionSource,
  executionId: string,
): string => {
  if (source === "schedule") return `scheduleExecution:${executionId}`;
  if (source === "http-trigger") return `httpTriggerExecution:${executionId}`;
  return `manualExecution:${executionId}`;
};

/**
 * Cancels one execution across queue + orchestration rows with idempotent behavior.
 *
 * @param source - Execution source (`schedule`, `http-trigger`, or `manual`).
 * @param executionId - Parent execution id.
 * @param deps - Optional collaborators for tests.
 * @returns Cancellation outcome (`cancelled`, `already_terminal`, or `not_found`).
 */
export const cancelExecution = async (
  source: ExecutionSource,
  executionId: string,
  deps: CancelExecutionDeps = {},
): Promise<CancelExecutionResult> => {
  const db = deps.db ?? prisma;
  const queue = deps.queue ?? getHermesJobQueue();
  const now = deps.now ?? (() => new Date());

  const cancelledAt = now();
  const executionTag = getExecutionTag(source, executionId);

  if (source === "schedule") {
    const row = await db.scheduleExecution.findUnique({
      where: { id: executionId },
      select: { runStatus: true },
    });
    if (!row) return { kind: "not_found" };
    if (!isCancellableRunStatus(row.runStatus)) {
      return { kind: "already_terminal", runStatus: row.runStatus };
    }

    await queue.cancelAllUpcomingJobs({
      tags: { values: [executionTag], mode: "all" },
    });

    await db.$transaction(async (tx) => {
      await tx.scheduleExecution.updateMany({
        where: {
          id: executionId,
          runStatus: { in: [...cancellableRunStatuses] },
        },
        data: { runStatus: ScheduleRunStatus.cancelled },
      });

      await tx.scheduleStepExecution.updateMany({
        where: {
          scheduleExecutionId: executionId,
          rollupStatus: { in: [...cancellableStepRollupStatuses] },
        },
        data: { rollupStatus: ScheduleStepRollupStatus.cancelled },
      });

      await tx.agentJobExecution.updateMany({
        where: {
          scheduleExecutionId: executionId,
          status: { in: [...cancellableInvocationStatuses] },
        },
        data: {
          status: AgentJobExecutionStatus.cancelled,
          completedAt: cancelledAt,
          error: {
            message: "Execution cancelled by dashboard user",
            cancelled: true,
          },
        },
      });
    });

    return { kind: "cancelled", runStatus: ScheduleRunStatus.cancelled };
  }

  if (source === "http-trigger") {
    const row = await db.httpTriggerExecution.findUnique({
      where: { id: executionId },
      select: { runStatus: true },
    });
    if (!row) return { kind: "not_found" };
    if (!isCancellableRunStatus(row.runStatus)) {
      return { kind: "already_terminal", runStatus: row.runStatus };
    }

    await queue.cancelAllUpcomingJobs({
      tags: { values: [executionTag], mode: "all" },
    });

    await db.$transaction(async (tx) => {
      await tx.httpTriggerExecution.updateMany({
        where: {
          id: executionId,
          runStatus: { in: [...cancellableRunStatuses] },
        },
        data: { runStatus: ScheduleRunStatus.cancelled },
      });

      await tx.httpTriggerStepExecution.updateMany({
        where: {
          httpTriggerExecutionId: executionId,
          rollupStatus: { in: [...cancellableStepRollupStatuses] },
        },
        data: { rollupStatus: ScheduleStepRollupStatus.cancelled },
      });

      await tx.agentJobExecution.updateMany({
        where: {
          httpTriggerExecutionId: executionId,
          status: { in: [...cancellableInvocationStatuses] },
        },
        data: {
          status: AgentJobExecutionStatus.cancelled,
          completedAt: cancelledAt,
          error: {
            message: "Execution cancelled by dashboard user",
            cancelled: true,
          },
        },
      });
    });

    return { kind: "cancelled", runStatus: ScheduleRunStatus.cancelled };
  }

  const row = await db.manualPipelineExecution.findUnique({
    where: { id: executionId },
    select: { runStatus: true },
  });
  if (!row) return { kind: "not_found" };
  if (!isCancellableRunStatus(row.runStatus)) {
    return { kind: "already_terminal", runStatus: row.runStatus };
  }

  await queue.cancelAllUpcomingJobs({
    tags: { values: [executionTag], mode: "all" },
  });

  await db.$transaction(async (tx) => {
    await tx.manualPipelineExecution.updateMany({
      where: {
        id: executionId,
        runStatus: { in: [...cancellableRunStatuses] },
      },
      data: { runStatus: ScheduleRunStatus.cancelled },
    });

    await tx.manualPipelineStepExecution.updateMany({
      where: {
        manualExecutionId: executionId,
        rollupStatus: { in: [...cancellableStepRollupStatuses] },
      },
      data: { rollupStatus: ScheduleStepRollupStatus.cancelled },
    });

    await tx.agentJobExecution.updateMany({
      where: {
        manualExecutionId: executionId,
        status: { in: [...cancellableInvocationStatuses] },
      },
      data: {
        status: AgentJobExecutionStatus.cancelled,
        completedAt: cancelledAt,
        error: {
          message: "Execution cancelled by dashboard user",
          cancelled: true,
        },
      },
    });
  });

  return { kind: "cancelled", runStatus: ScheduleRunStatus.cancelled };
};
