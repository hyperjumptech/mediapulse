type CronParserLike = {
  parseExpression?: (
    expr: string,
    opts: { currentDate?: Date; tz?: string },
  ) => { next: () => { toDate: () => Date } };
  CronExpressionParser?: {
    parse: (
      expr: string,
      opts: { currentDate?: Date; tz?: string },
    ) => { next: () => { toDate: () => Date } };
  };
};

// eslint-disable-next-line @typescript-eslint/no-require-imports -- cron-parser CJS default export
const cronParser = require("cron-parser") as CronParserLike;
import type { ScheduleRepeat } from "@hermes/orchestration-database";

/** Schedule-like shape with fields needed to compute next run. */
export type ScheduleForNextRun = {
  repeat: ScheduleRepeat;
  cronExpression: string | null;
  interval: number | null;
  timezone: string;
  nextRunAt: Date | null;
};

/**
 * Computes the next run time for a repeating schedule (cron or interval). Returns null for 'once' or if computation fails.
 *
 * @param schedule - Schedule with repeat, cronExpression, interval, timezone.
 * @param after - Compute next run after this date (default: now).
 * @returns Next run date or null.
 */
export const computeNextRunAt = (
  schedule: ScheduleForNextRun,
  after: Date = new Date(),
): Date | null => {
  if (schedule.repeat !== "repeating") return null;

  if (schedule.cronExpression) {
    try {
      const parser =
        typeof cronParser.parseExpression === "function"
          ? {
              parse: (
                expr: string,
                opts: { currentDate?: Date; tz?: string },
              ) => cronParser.parseExpression!(expr, opts),
            }
          : cronParser.CronExpressionParser;
      if (parser == null || typeof parser.parse !== "function") {
        return null;
      }
      const iter = parser.parse(schedule.cronExpression, {
        currentDate: after,
        tz: schedule.timezone || "UTC",
      });
      const next = iter.next();
      return next.toDate();
    } catch {
      return null;
    }
  }

  if (typeof schedule.interval === "number" && schedule.interval > 0) {
    const from =
      schedule.nextRunAt && schedule.nextRunAt > after
        ? schedule.nextRunAt
        : after;
    return new Date(from.getTime() + schedule.interval);
  }

  return null;
};
