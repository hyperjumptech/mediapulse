import type { PrismaClient } from "@workspace/orchestration-database";

/** DB type that provides schedule queries (injectable for tests). */
export type GetDueSchedulesDb = Pick<PrismaClient, "schedule">;

/**
 * Fetches all enabled schedules whose next run time has passed.
 *
 * @param db - Prisma client or minimal schedule client.
 * @returns Schedules that are due to run (nextRunAt <= now), with pipeline and steps.
 */
export const getDueSchedules = async (db: GetDueSchedulesDb) => {
  const now = new Date();
  return db.schedule.findMany({
    where: {
      enabled: true,
      nextRunAt: { lte: now },
    },
    include: {
      pipeline: {
        include: {
          steps: {
            orderBy: { order: "asc" },
            include: { agentConfig: true },
          },
        },
      },
    },
  });
};

/** Schedule with pipeline and steps (including agentConfig when referenced). */
export type DueSchedule = Awaited<ReturnType<typeof getDueSchedules>>[number];
