import {
  AgentJobExecutionStatus,
  type PrismaClient,
} from "@hermes/orchestration-database";
import {
  applyInvocationCompletion,
  type ApplyInvocationCompletionDeps,
} from "@hermes/scheduler";

/** Minimum orphan age in minutes before a record is eligible for cleanup. */
export const DEFAULT_ORPHAN_THRESHOLD_MINUTES = 35;

/**
 * Dependencies for {@link cleanupOrphanedExecutions}.
 */
export type CleanupOrphanedExecutionsDeps = {
  db: PrismaClient;
  logger: ApplyInvocationCompletionDeps["logger"];
  /** Rows running longer than this many minutes are treated as orphaned. Defaults to 60. */
  thresholdMinutes?: number;
};

/** Fields read from orphaned agent_job_execution rows. */
type OrphanedRow = {
  id: string;
  jobId: string;
  scheduleExecutionId: string | null;
  httpTriggerExecutionId: string | null;
  manualExecutionId: string | null;
  pipelineStepId: string | null;
  startedAt: Date | null;
};

/**
 * Finds `agent_job_execution` rows that have been `running` for longer than `thresholdMinutes`
 * without a `completedAt` timestamp (orphans left behind by worker crashes or DataQueue DLQ
 * exhaustion) and drives each one to a terminal `failed` state via `applyInvocationCompletion`.
 * Rows with no parent execution id are marked directly without step-rollup updates.
 *
 * @param deps - Injected db client, logger, and optional threshold.
 * @returns The number of rows that were resolved.
 */
export const cleanupOrphanedExecutions = async (
  deps: CleanupOrphanedExecutionsDeps,
): Promise<number> => {
  const {
    db,
    logger,
    thresholdMinutes = DEFAULT_ORPHAN_THRESHOLD_MINUTES,
  } = deps;

  const cutoff = new Date(Date.now() - thresholdMinutes * 60 * 1_000);

  const rows = await db.agentJobExecution.findMany({
    where: {
      status: AgentJobExecutionStatus.running,
      completedAt: null,
      startedAt: { lt: cutoff },
    },
    select: {
      id: true,
      jobId: true,
      scheduleExecutionId: true,
      httpTriggerExecutionId: true,
      manualExecutionId: true,
      pipelineStepId: true,
      startedAt: true,
    },
  });

  if (rows.length === 0) {
    return 0;
  }

  logger.warn(
    { count: rows.length, thresholdMinutes },
    "cleanup_orphaned_executions: found stuck running rows",
  );

  const completionDeps: ApplyInvocationCompletionDeps = { db, logger };
  let resolved = 0;

  for (const row of rows as OrphanedRow[]) {
    try {
      const hasParent = Boolean(
        row.scheduleExecutionId ??
        row.httpTriggerExecutionId ??
        row.manualExecutionId,
      );

      if (hasParent && row.pipelineStepId) {
        await applyInvocationCompletion(
          {
            jobId: row.jobId,
            scheduleExecutionId: row.scheduleExecutionId ?? undefined,
            httpTriggerExecutionId: row.httpTriggerExecutionId ?? undefined,
            manualExecutionId: row.manualExecutionId ?? undefined,
            pipelineStepId: row.pipelineStepId,
            terminal: {
              status: AgentJobExecutionStatus.failed,
              error: {
                message: `Orphaned: still running after ${thresholdMinutes} minutes — worker crash or DataQueue DLQ exhaustion`,
                retryable: false,
                orphanCleanup: true,
              },
            },
          },
          completionDeps,
        );
      } else {
        await db.agentJobExecution.update({
          where: { jobId: row.jobId },
          data: {
            status: AgentJobExecutionStatus.failed,
            completedAt: new Date(),
            error: {
              message: `Orphaned: still running after ${thresholdMinutes} minutes — worker crash or DataQueue DLQ exhaustion (no parent execution)`,
              retryable: false,
              orphanCleanup: true,
            },
          },
        });
      }

      logger.warn(
        { jobId: row.jobId, startedAt: row.startedAt },
        "cleanup_orphaned_executions: resolved orphaned row",
      );
      resolved++;
    } catch (err) {
      logger.error(
        { err, jobId: row.jobId },
        "cleanup_orphaned_executions: failed to resolve row — will retry next sweep",
      );
    }
  }

  return resolved;
};
