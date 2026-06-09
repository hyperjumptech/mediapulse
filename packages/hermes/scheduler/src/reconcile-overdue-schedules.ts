import type { PrismaClient } from "@hermes/orchestration-database";
import { computeNextRunAt, type ScheduleForNextRun } from "./next-run-at";

const MISSED_OCCURRENCES_CAP = 10_000;

export type ScheduleForRecovery = ScheduleForNextRun & {
  id: string;
  enabled: boolean;
};

export type PlanScheduleRecoveryResult =
  | { action: "leave" }
  | { action: "skip-forward"; newNextRunAt: Date; missedOccurrences: number };

/**
 * Decides whether a schedule needs to be rolled forward after downtime.
 *
 * @param schedule - The schedule to evaluate.
 * @param now - Current time (injected for testability).
 * @param graceMs - Overdue window within which schedules are left to run normally.
 * @returns skip-forward with new next-run and missed count, or leave unchanged.
 */
export const planScheduleRecovery = (
  schedule: ScheduleForRecovery,
  now: Date,
  graceMs: number,
): PlanScheduleRecoveryResult => {
  if (
    !schedule.enabled ||
    schedule.repeat !== "repeating" ||
    schedule.nextRunAt == null
  ) {
    return { action: "leave" };
  }

  const overdueMs = now.getTime() - schedule.nextRunAt.getTime();
  if (overdueMs <= graceMs) {
    return { action: "leave" };
  }

  const newNextRunAt = computeNextRunAt(schedule, now);
  if (newNextRunAt == null) {
    return { action: "leave" };
  }

  const missedOccurrences = computeMissedOccurrences(schedule, now);

  return { action: "skip-forward", newNextRunAt, missedOccurrences };
};

function computeMissedOccurrences(
  schedule: ScheduleForRecovery,
  now: Date,
): number {
  const nextRunAt = schedule.nextRunAt!;

  if (typeof schedule.interval === "number" && schedule.interval > 0) {
    const overdueMs = now.getTime() - nextRunAt.getTime();
    return Math.max(1, Math.floor(overdueMs / schedule.interval));
  }

  if (schedule.cronExpression != null) {
    let count = 1;
    let cursor = nextRunAt;
    while (count < MISSED_OCCURRENCES_CAP) {
      const next = computeNextRunAt({ ...schedule, nextRunAt: cursor }, cursor);
      if (next == null || next.getTime() >= now.getTime()) break;
      count++;
      cursor = next;
    }
    return count;
  }

  return 1;
}

export type ReconcileSchedulesDb = Pick<PrismaClient, "schedule">;

export type ReconcileLogger = {
  info: (obj: Record<string, unknown>, msg: string) => void;
  warn: (obj: Record<string, unknown>, msg: string) => void;
};

export type ReconcileOverdueSchedulesDeps = {
  db: ReconcileSchedulesDb;
  logger: ReconcileLogger;
  graceMs?: number;
};

export type ReconcileOverdueSchedulesResult = {
  reconciledCount: number;
  totalMissed: number;
};

/**
 * Rolls stale repeating schedules forward after downtime, recording skipped occurrence counts.
 * Enqueues nothing — the recovery policy is skip, not catch-up.
 *
 * @param deps - Database client, logger, and optional grace window in ms (default 15 minutes).
 * @returns Summary of how many schedules were reconciled and total missed occurrences.
 */
export const reconcileOverdueSchedules = async (
  deps: ReconcileOverdueSchedulesDeps,
): Promise<ReconcileOverdueSchedulesResult> => {
  const { db, logger, graceMs = 900_000 } = deps;
  const now = new Date();
  const threshold = new Date(now.getTime() - graceMs);

  const schedules = await db.schedule.findMany({
    where: {
      enabled: true,
      repeat: "repeating",
      nextRunAt: { lt: threshold },
    },
    select: {
      id: true,
      repeat: true,
      cronExpression: true,
      interval: true,
      timezone: true,
      nextRunAt: true,
      enabled: true,
    },
  });

  let reconciledCount = 0;
  let totalMissed = 0;

  for (const schedule of schedules) {
    const plan = planScheduleRecovery(schedule, now, graceMs);
    if (plan.action !== "skip-forward") continue;

    const previousNextRunAt = schedule.nextRunAt;

    await db.schedule.update({
      where: { id: schedule.id },
      data: {
        nextRunAt: plan.newNextRunAt,
        lastRecoveredAt: now,
        lastMissedRunCount: plan.missedOccurrences,
      },
    });

    logger.info(
      {
        scheduleId: schedule.id,
        previousNextRunAt,
        newNextRunAt: plan.newNextRunAt,
        missedOccurrences: plan.missedOccurrences,
        reason: "downtime-recovery",
      },
      "schedule_recovery: rolled stale schedule forward",
    );

    reconciledCount++;
    totalMissed += plan.missedOccurrences;
  }

  return { reconciledCount, totalMissed };
};
