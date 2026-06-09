import type { ReconcileLogger, ReconcileSchedulesDb } from "@hermes/scheduler";
import { reconcileOverdueSchedules } from "@hermes/scheduler";

export type StartupReconciliationDeps = {
  db: ReconcileSchedulesDb;
  logger: ReconcileLogger & {
    error: (obj: Record<string, unknown>, msg: string) => void;
  };
  graceMs: number;
};

/**
 * Runs the overdue-schedule reconciliation pass at worker startup.
 * Logs the result on success. Catches and logs any thrown error so a
 * reconciliation failure never blocks the processor from starting.
 */
export async function runStartupReconciliation(
  deps: StartupReconciliationDeps,
): Promise<void> {
  const { db, logger, graceMs } = deps;
  try {
    const result = await reconcileOverdueSchedules({ db, logger, graceMs });
    logger.info(
      {
        reconciledCount: result.reconciledCount,
        totalMissed: result.totalMissed,
      },
      "schedule_recovery: startup reconciliation complete",
    );
  } catch (err) {
    logger.error(
      { err },
      "schedule_recovery: startup reconciliation failed, continuing",
    );
  }
}
