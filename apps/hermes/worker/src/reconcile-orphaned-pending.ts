import {
  AgentJobExecutionStatus,
  ScheduleStepRollupStatus,
  type PrismaClient,
} from "@hermes/orchestration-database";
import {
  applyInvocationCompletion,
  parseEffectiveExecutionConfig,
  type ApplyInvocationCompletionDeps,
} from "@hermes/scheduler";

export const DEFAULT_PENDING_ORPHAN_THRESHOLD_MINUTES = 35;

/** Minimal subset of the DataQueue pg Pool used for raw SQL in reconciliation. */
type DataQueuePool = {
  query<T extends object = object>(
    text: string,
    values?: unknown[],
  ): Promise<{ rows: T[] }>;
};

export type ReconcileOrphanedPendingDeps = {
  db: PrismaClient;
  dataQueuePool: DataQueuePool;
  logger: ApplyInvocationCompletionDeps["logger"];
  thresholdMinutes?: number;
};

export type ReconcileOrphanedPendingResult = {
  reEnqueued: number;
  settled: number;
};

type PendingOrphanRow = {
  jobId: string;
  scheduleExecutionId: string | null;
  httpTriggerExecutionId: string | null;
  manualExecutionId: string | null;
  pipelineStepId: string | null;
  pipelineId: string | null;
  enqueuedAt: Date;
};

type DataQueueJobRow = {
  id: number;
  status: string;
  pending_reason: string | null;
  next_attempt_at: Date | null;
};

type ExecutionKind = "schedule" | "httpTrigger" | "manual";

function getExecutionKind(row: PendingOrphanRow): ExecutionKind | null {
  if (row.scheduleExecutionId) return "schedule";
  if (row.httpTriggerExecutionId) return "httpTrigger";
  if (row.manualExecutionId) return "manual";
  return null;
}

function isCascadeCancelled(pendingReason: string | null): boolean {
  if (!pendingReason) return false;
  try {
    const parsed = JSON.parse(pendingReason) as Record<string, unknown>;
    return parsed.dependencyCascade === true;
  } catch {
    return false;
  }
}

async function lookupDataQueueJob(
  pool: DataQueuePool,
  jobId: string,
): Promise<DataQueueJobRow | null> {
  const result = await pool.query<DataQueueJobRow>(
    `SELECT id, status, pending_reason, next_attempt_at
     FROM job_queue
     WHERE idempotency_key = $1
     LIMIT 1`,
    [jobId],
  );
  return result.rows[0] ?? null;
}

async function resetCascadeCancelledJobToPending(
  pool: DataQueuePool,
  dqJobId: number,
): Promise<boolean> {
  const result = await pool.query<{ id: number }>(
    `UPDATE job_queue
     SET status          = 'pending',
         run_at          = NOW(),
         locked_at       = NULL,
         locked_by       = NULL,
         last_cancelled_at = NULL,
         attempts        = 0,
         pending_reason  = NULL,
         depends_on_job_ids = '{}',
         wait_until      = NULL,
         wait_token_id   = NULL
     WHERE id = $1 AND status = 'cancelled'
     RETURNING id`,
    [dqJobId],
  );
  return result.rows.length > 0;
}

/**
 * Returns true when the immediate predecessor step's rollup status allows the
 * current step to proceed. For `partial`, consults `continueSequentialAfterPartial`
 * from the execution's effective config.
 */
async function predecessorStepAllowsContinuation(
  db: PrismaClient,
  row: PendingOrphanRow,
  executionKind: ExecutionKind,
): Promise<boolean> {
  if (!row.pipelineStepId || !row.pipelineId) return false;

  const thisStep = await db.pipelineStep.findUnique({
    where: { id: row.pipelineStepId },
    select: { order: true },
  });
  if (!thisStep) return false;

  const predecessorStep = await db.pipelineStep.findFirst({
    where: { pipelineId: row.pipelineId, order: { lt: thisStep.order } },
    orderBy: { order: "desc" },
    select: { id: true },
  });
  if (!predecessorStep) return false; // First wave — cannot be cascade-cancelled from an upstream dep

  let predecessorRollup: ScheduleStepRollupStatus | null = null;

  if (executionKind === "schedule" && row.scheduleExecutionId) {
    const stepExec = await db.scheduleStepExecution.findUnique({
      where: {
        scheduleExecutionId_pipelineStepId: {
          scheduleExecutionId: row.scheduleExecutionId,
          pipelineStepId: predecessorStep.id,
        },
      },
      select: { rollupStatus: true },
    });
    predecessorRollup = stepExec?.rollupStatus ?? null;
  } else if (executionKind === "httpTrigger" && row.httpTriggerExecutionId) {
    const stepExec = await db.httpTriggerStepExecution.findUnique({
      where: {
        httpTriggerExecutionId_pipelineStepId: {
          httpTriggerExecutionId: row.httpTriggerExecutionId,
          pipelineStepId: predecessorStep.id,
        },
      },
      select: { rollupStatus: true },
    });
    predecessorRollup = stepExec?.rollupStatus ?? null;
  } else if (executionKind === "manual" && row.manualExecutionId) {
    const stepExec = await db.manualPipelineStepExecution.findUnique({
      where: {
        manualExecutionId_pipelineStepId: {
          manualExecutionId: row.manualExecutionId,
          pipelineStepId: predecessorStep.id,
        },
      },
      select: { rollupStatus: true },
    });
    predecessorRollup = stepExec?.rollupStatus ?? null;
  }

  if (predecessorRollup === null) return false;
  if (predecessorRollup === ScheduleStepRollupStatus.success) return true;

  if (predecessorRollup === ScheduleStepRollupStatus.partial) {
    let configJson: unknown = null;
    try {
      if (executionKind === "schedule" && row.scheduleExecutionId) {
        const execution = await db.scheduleExecution.findUnique({
          where: { id: row.scheduleExecutionId },
          select: { effectiveExecutionConfig: true },
        });
        configJson = execution?.effectiveExecutionConfig;
      } else if (
        executionKind === "httpTrigger" &&
        row.httpTriggerExecutionId
      ) {
        const execution = await db.httpTriggerExecution.findUnique({
          where: { id: row.httpTriggerExecutionId },
          select: { effectiveExecutionConfig: true },
        });
        configJson = execution?.effectiveExecutionConfig;
      } else if (executionKind === "manual" && row.manualExecutionId) {
        const execution = await db.manualPipelineExecution.findUnique({
          where: { id: row.manualExecutionId },
          select: { effectiveExecutionConfig: true },
        });
        configJson = execution?.effectiveExecutionConfig;
      }
      if (
        configJson != null &&
        typeof configJson === "object" &&
        !Array.isArray(configJson)
      ) {
        const config = parseEffectiveExecutionConfig(
          configJson as Record<string, unknown>,
        );
        return config.continueSequentialAfterPartial;
      }
    } catch {
      return false;
    }
  }

  return false;
}

async function settleOrphanedPendingRow(
  row: PendingOrphanRow,
  status: "failed" | "cancelled",
  completionDeps: ApplyInvocationCompletionDeps,
  db: PrismaClient,
): Promise<void> {
  const executionKind = getExecutionKind(row);
  const isCancelled = status === "cancelled";

  if (executionKind && row.pipelineStepId) {
    await applyInvocationCompletion(
      {
        jobId: row.jobId,
        scheduleExecutionId: row.scheduleExecutionId ?? undefined,
        httpTriggerExecutionId: row.httpTriggerExecutionId ?? undefined,
        manualExecutionId: row.manualExecutionId ?? undefined,
        pipelineStepId: row.pipelineStepId,
        terminal: isCancelled
          ? {
              status: AgentJobExecutionStatus.cancelled,
              error: {
                cancelled: true,
                message:
                  "Orphaned pending: DataQueue job cancelled — user cancel or dependency cascade with failed upstream",
                retryable: false,
                orphanCleanup: true,
              },
            }
          : {
              status: AgentJobExecutionStatus.failed,
              error: {
                message:
                  "Orphaned pending: DataQueue job absent or terminal-failed — worker crash or DLQ exhaustion",
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
        status: isCancelled
          ? AgentJobExecutionStatus.cancelled
          : AgentJobExecutionStatus.failed,
        completedAt: new Date(),
        error: {
          message: isCancelled
            ? "Orphaned pending: DataQueue job cancelled (no parent execution)"
            : "Orphaned pending: DataQueue job absent or terminal-failed (no parent execution)",
          retryable: false,
          orphanCleanup: true,
        },
      },
    });
  }
}

/**
 * Scans `agent_job_execution` rows that are still `pending` past `thresholdMinutes` and whose
 * DataQueue job has reached a terminal state without the worker running `applyInvocationCompletion`.
 *
 * Two actions are taken per row:
 * - **Re-enqueue**: when the DataQueue job was cascade-cancelled due to a transient upstream failure
 *   that ultimately succeeded (predecessor step rollup is `success` / `partial` with
 *   `continueSequentialAfterPartial`), the cancelled DataQueue job is reset to `pending` (dependency
 *   links cleared) so the worker picks it up on the next poll. This is the recovery path for the
 *   bug where DataQueue cascade-cancels downstream `waiting` jobs on every upstream failure —
 *   even transient ones that DataQueue will later retry to success.
 * - **Settle**: for all other terminal DataQueue states (user-cancel, terminal-failed, absent),
 *   drives the orchestration row through `applyInvocationCompletion` so the parent execution
 *   recomputes its rollup and reaches a terminal state. Covers the `pending` / `startedAt = null`
 *   blind spot that `cleanupOrphanedExecutions` (which only scans `running` rows) cannot reach.
 *
 * @param deps - Injected db, DataQueue pool, logger, and optional threshold.
 * @returns Counts of re-enqueued and settled rows.
 */
export async function reconcileOrphanedPendingExecutions(
  deps: ReconcileOrphanedPendingDeps,
): Promise<ReconcileOrphanedPendingResult> {
  const {
    db,
    dataQueuePool,
    logger,
    thresholdMinutes = DEFAULT_PENDING_ORPHAN_THRESHOLD_MINUTES,
  } = deps;

  const cutoff = new Date(Date.now() - thresholdMinutes * 60 * 1_000);

  const rows = await db.agentJobExecution.findMany({
    where: {
      status: AgentJobExecutionStatus.pending,
      completedAt: null,
      enqueuedAt: { lt: cutoff },
    },
    select: {
      jobId: true,
      scheduleExecutionId: true,
      httpTriggerExecutionId: true,
      manualExecutionId: true,
      pipelineStepId: true,
      pipelineId: true,
      enqueuedAt: true,
    },
  });

  if (rows.length === 0) {
    return { reEnqueued: 0, settled: 0 };
  }

  logger.warn(
    { count: rows.length, thresholdMinutes },
    "reconcile_orphaned_pending: found stuck pending rows",
  );

  const completionDeps: ApplyInvocationCompletionDeps = { db, logger };
  let reEnqueued = 0;
  let settled = 0;

  for (const row of rows as PendingOrphanRow[]) {
    try {
      const dqJob = await lookupDataQueueJob(dataQueuePool, row.jobId);

      if (!dqJob) {
        await settleOrphanedPendingRow(row, "failed", completionDeps, db);
        settled++;
        logger.warn(
          { jobId: row.jobId },
          "reconcile_orphaned_pending: settled absent-job row as failed",
        );
        continue;
      }

      // Skip jobs whose DataQueue state is not terminal: they are still live or awaiting retry.
      const isPendingRetry =
        dqJob.status === "failed" && dqJob.next_attempt_at !== null;
      if (
        dqJob.status === "pending" ||
        dqJob.status === "processing" ||
        dqJob.status === "waiting" ||
        isPendingRetry
      ) {
        continue;
      }

      if (
        dqJob.status === "cancelled" &&
        isCascadeCancelled(dqJob.pending_reason)
      ) {
        const executionKind = getExecutionKind(row);

        if (executionKind && row.pipelineStepId) {
          const canReEnqueue = await predecessorStepAllowsContinuation(
            db,
            row,
            executionKind,
          );

          if (canReEnqueue) {
            const reset = await resetCascadeCancelledJobToPending(
              dataQueuePool,
              dqJob.id,
            );
            if (reset) {
              reEnqueued++;
              logger.warn(
                { jobId: row.jobId, dqJobId: dqJob.id },
                "reconcile_orphaned_pending: re-enqueued cascade-cancelled job (upstream step succeeded)",
              );
            }
            // Whether or not the reset succeeded, skip settling — the job is either
            // now pending (success) or already changed state (another process picked it up).
            continue;
          }
        }

        // Upstream step did not succeed — settle the downstream row as cancelled.
        await settleOrphanedPendingRow(row, "cancelled", completionDeps, db);
        settled++;
        logger.warn(
          { jobId: row.jobId },
          "reconcile_orphaned_pending: settled cascade-cancelled row (upstream failed)",
        );
        continue;
      }

      // User-cancelled or terminal-failed — settle accordingly.
      const terminalStatus =
        dqJob.status === "cancelled" ? "cancelled" : "failed";
      await settleOrphanedPendingRow(row, terminalStatus, completionDeps, db);
      settled++;
      logger.warn(
        { jobId: row.jobId, dqStatus: dqJob.status },
        "reconcile_orphaned_pending: settled orphaned pending row",
      );
    } catch (err) {
      logger.error(
        { err, jobId: row.jobId },
        "reconcile_orphaned_pending: failed to process row — will retry next sweep",
      );
    }
  }

  return { reEnqueued, settled };
}
