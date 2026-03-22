import type { Prisma } from "@hermes/orchestration-database";
import { prisma } from "@hermes/orchestration-database";

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

/** Shape of a single execution returned by getScheduleExecutionsPage. */
export type ScheduleExecutionRow = {
  id: string;
  executionTime: Date;
  enqueueStatus: string;
  runStatus: string;
  jobsCreated: number;
  jobsEnqueued: number;
  succeededInvocationCount: number;
  failedInvocationCount: number;
  errors: unknown;
  createdAt: Date;
};

export type ScheduleExecutionsPageResult = {
  executions: ScheduleExecutionRow[];
  total: number;
  page: number;
  pageSize: number;
};

/**
 * Fetches a paginated list of schedule executions for a schedule, newest first.
 *
 * @param scheduleId - UUID of the schedule.
 * @param page - 1-based page number.
 * @param pageSize - Number of items per page.
 * @param db - Prisma client (injectable for tests).
 * @returns Executions for the page plus total count and pagination info.
 */
export const getScheduleExecutionsPage = async (
  scheduleId: string,
  page: number,
  pageSize: number,
  db: Db = prisma,
): Promise<ScheduleExecutionsPageResult> => {
  const skip = (page - 1) * pageSize;
  const where = { scheduleId };

  const [executions, total] = await Promise.all([
    db.scheduleExecution.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { executionTime: "desc" },
      select: {
        id: true,
        executionTime: true,
        enqueueStatus: true,
        runStatus: true,
        jobsCreated: true,
        jobsEnqueued: true,
        succeededInvocationCount: true,
        failedInvocationCount: true,
        errors: true,
        createdAt: true,
      },
    }),
    db.scheduleExecution.count({ where }),
  ]);

  return {
    executions: executions as ScheduleExecutionRow[],
    total,
    page,
    pageSize,
  };
};

/** Full execution detail for admin debugging (steps + invocations). */
export type ScheduleExecutionDetail = {
  execution: {
    id: string;
    executionTime: Date;
    enqueueStatus: string;
    runStatus: string;
    effectiveExecutionConfig: unknown;
    jobsCreated: number;
    jobsEnqueued: number;
    succeededInvocationCount: number;
    failedInvocationCount: number;
    errors: unknown;
    createdAt: Date;
  };
  pipeline: { id: string; name: string } | null;
  schedule: { id: string; name: string };
  stepExecutions: Array<{
    pipelineStepId: string;
    stepOrder: number;
    agentId: string;
    agentVersion: string;
    expectedInvocationCount: number;
    succeededCount: number;
    failedCount: number;
    rollupStatus: string;
  }>;
  invocations: Array<{
    jobId: string;
    status: string;
    agentId: string;
    pipelineStepId: string | null;
    error: unknown;
    agentResponse: unknown;
    semanticStatus: string | null;
    startedAt: Date | null;
    completedAt: Date | null;
  }>;
};

/**
 * Loads one schedule execution with pipeline/schedule context, per-step rollup rows, and invocations.
 *
 * @param scheduleId - Schedule id (must own the execution).
 * @param executionId - Schedule execution id.
 * @param db - Prisma client.
 */
export const getScheduleExecutionDetail = async (
  scheduleId: string,
  executionId: string,
  db: Db = prisma,
): Promise<ScheduleExecutionDetail | null> => {
  const row = await db.scheduleExecution.findFirst({
    where: { id: executionId, scheduleId },
    include: {
      schedule: { select: { id: true, name: true, pipelineId: true } },
      scheduleStepExecutions: {
        include: {
          pipelineStep: {
            select: {
              id: true,
              order: true,
              agentId: true,
              agentVersion: true,
            },
          },
        },
      },
      agentJobExecutions: {
        orderBy: { enqueuedAt: "asc" },
        select: {
          jobId: true,
          status: true,
          agentId: true,
          pipelineStepId: true,
          error: true,
          agentResponse: true,
          semanticStatus: true,
          startedAt: true,
          completedAt: true,
        },
      },
    },
  });
  if (!row) return null;

  const pipeline = await db.pipeline.findUnique({
    where: { id: row.schedule.pipelineId },
    select: { id: true, name: true },
  });

  const stepExecutions = row.scheduleStepExecutions
    .map((se) => ({
      pipelineStepId: se.pipelineStepId,
      stepOrder: se.pipelineStep.order,
      agentId: se.pipelineStep.agentId,
      agentVersion: se.pipelineStep.agentVersion,
      expectedInvocationCount: se.expectedInvocationCount,
      succeededCount: se.succeededCount,
      failedCount: se.failedCount,
      rollupStatus: se.rollupStatus,
    }))
    .sort((a, b) => a.stepOrder - b.stepOrder);

  return {
    execution: {
      id: row.id,
      executionTime: row.executionTime,
      enqueueStatus: row.enqueueStatus,
      runStatus: row.runStatus,
      effectiveExecutionConfig: row.effectiveExecutionConfig,
      jobsCreated: row.jobsCreated,
      jobsEnqueued: row.jobsEnqueued,
      succeededInvocationCount: row.succeededInvocationCount,
      failedInvocationCount: row.failedInvocationCount,
      errors: row.errors,
      createdAt: row.createdAt,
    },
    pipeline,
    schedule: { id: row.schedule.id, name: row.schedule.name },
    stepExecutions,
    invocations: row.agentJobExecutions.map((j) => ({
      jobId: j.jobId,
      status: j.status,
      agentId: j.agentId,
      pipelineStepId: j.pipelineStepId,
      error: j.error,
      agentResponse: j.agentResponse,
      semanticStatus: j.semanticStatus,
      startedAt: j.startedAt,
      completedAt: j.completedAt,
    })),
  };
};
