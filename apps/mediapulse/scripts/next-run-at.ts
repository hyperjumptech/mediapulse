import { CronExpressionParser } from "cron-parser";

/** The shape both seeders hold: a repeating, cron-driven schedule. */
export type CronScheduleForNextRun = {
  repeat: "repeating";
  cronExpression: string;
  interval: null;
  timezone: string;
  nextRunAt: null;
};

/**
 * Computes the next occurrence of a cron schedule in its own timezone.
 *
 * - Important: this exists instead of `@hermes/scheduler`'s `computeNextRunAt` because that module
 *   reaches for `require` inside an ESM package. Bun tolerates it, so the worker is fine, and `tsx`
 *   does not, so a script importing it fails at run time. Only the cron case is covered, which is
 *   all either seeder writes.
 *
 * @param schedule - The cron expression and the timezone it is read in.
 * @param now - The instant to search forward from.
 * @returns The next run time, or null when the expression cannot be parsed.
 */
export const computeNextRunAt = (
  schedule: CronScheduleForNextRun,
  now: Date,
): Date | null => {
  try {
    return CronExpressionParser.parse(schedule.cronExpression, {
      currentDate: now,
      tz: schedule.timezone,
    })
      .next()
      .toDate();
  } catch {
    return null;
  }
};
