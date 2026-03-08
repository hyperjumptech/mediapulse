import type { Prisma, PrismaClient } from "@workspace/database";

/** DB type that provides schedule queries (injectable for tests). */
export type GetDueSchedulesDb = Pick<PrismaClient, "schedule">;

/** Schedule with pipeline and steps (including agentConfig when step references one) included (returned by getDueSchedules). */
export type DueSchedule = Prisma.ScheduleGetPayload<{
  include: {
    pipeline: { include: { steps: { include: { agentConfig: true } } } };
  };
}>;

/**
 * Fetches all enabled schedules whose next run time has passed.
 *
 * @param db - Prisma client or minimal schedule client.
 * @returns Schedules that are due to run (nextRunAt <= now), with pipeline and steps.
 */
export const getDueSchedules = async (
  db: GetDueSchedulesDb,
): Promise<DueSchedule[]> => {
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
