import type { Prisma } from "@workspace/database";
import { prisma } from "@workspace/database";

type Db = typeof prisma;

const scheduleListInclude = {
  pipeline: { select: { id: true, name: true } },
} as const;

export type SchedulesPageResult = {
  schedules: Prisma.ScheduleGetPayload<{
    include: typeof scheduleListInclude;
  }>[];
  total: number;
  page: number;
  pageSize: number;
};

/**
 * Builds a Prisma where clause for schedule search by name or description (partial, case-insensitive).
 *
 * @param search - Raw search string; trimmed and ignored if empty.
 * @returns Where clause object or undefined if no search.
 */
const scheduleSearchWhere = (
  search: string | undefined,
):
  | {
      OR: Array<
        | { name: { contains: string; mode: "insensitive" } }
        | { description: { contains: string; mode: "insensitive" } }
      >;
    }
  | undefined => {
  const term = search?.trim();
  if (!term) return undefined;
  return {
    OR: [
      { name: { contains: term, mode: "insensitive" } },
      { description: { contains: term, mode: "insensitive" } },
    ],
  };
};

export type ScheduleSortField = "name" | "nextRunAt" | "created" | "enabled";
export type ScheduleSortDir = "asc" | "desc";

const SORT_DEFAULT: {
  sortBy: ScheduleSortField;
  sortDir: ScheduleSortDir;
} = {
  sortBy: "name",
  sortDir: "asc",
};

/**
 * Builds Prisma orderBy from sort field and direction. "created" maps to createdAt.
 *
 * @param sortBy - Field to sort by (name, nextRunAt, created, or enabled).
 * @param sortDir - asc or desc.
 * @returns Prisma orderBy object.
 */
const scheduleOrderBy = (
  sortBy: ScheduleSortField,
  sortDir: ScheduleSortDir,
): Prisma.ScheduleOrderByWithRelationInput => {
  const dir = sortDir === "asc" ? "asc" : "desc";
  if (sortBy === "created") return { createdAt: dir };
  if (sortBy === "nextRunAt") return { nextRunAt: dir };
  if (sortBy === "enabled") return { enabled: dir };
  return { name: dir };
};

/**
 * Fetches a paginated list of schedules with optional sort and search.
 *
 * @param page - 1-based page number.
 * @param pageSize - Number of items per page.
 * @param options - Optional search term and sort (sortBy: name | nextRunAt | created | enabled, sortDir: asc | desc).
 * @param db - Prisma client (injectable for tests).
 * @returns Schedules for the page plus total count and pagination info.
 */
export const getSchedulesPage = async (
  page: number,
  pageSize: number,
  options?: {
    search?: string;
    sortBy?: ScheduleSortField;
    sortDir?: ScheduleSortDir;
  },
  db: Db = prisma,
): Promise<SchedulesPageResult> => {
  const skip = (page - 1) * pageSize;
  const where = scheduleSearchWhere(options?.search);
  const sortBy = options?.sortBy ?? SORT_DEFAULT.sortBy;
  const sortDir = options?.sortDir ?? SORT_DEFAULT.sortDir;
  const orderBy = scheduleOrderBy(sortBy, sortDir);

  const [schedules, total] = await Promise.all([
    db.schedule.findMany({
      where,
      skip,
      take: pageSize,
      orderBy,
      include: scheduleListInclude,
    }),
    db.schedule.count({ where }),
  ]);
  return { schedules, total, page, pageSize };
};

/**
 * Fetches a single schedule by id with pipeline, or null if not found.
 *
 * @param scheduleId - UUID of the schedule.
 * @param db - Prisma client (injectable for tests).
 * @returns The schedule with pipeline or null.
 */
export const getScheduleById = async (
  scheduleId: string,
  db: Db = prisma,
): Promise<Prisma.ScheduleGetPayload<{
  include: { pipeline: true };
}> | null> => {
  return db.schedule.findUnique({
    where: { id: scheduleId },
    include: { pipeline: true },
  });
};
