import type { Prisma } from "@hermes/orchestration-database";
import { prisma } from "@hermes/orchestration-database";

import {
  executionSummarySelect,
  invocationSummarySelect,
  stepExecutionSummarySelect,
  toExecutionSummary,
  toInvocationSummary,
  toStepExecutionSummaries,
  type ExecutionSummary,
  type InvocationSummary,
} from "./execution-summary";
import {
  attachExecutionElapsedLabels,
  type PipelineExecutionRow,
} from "./pipeline-executions";

type Db = typeof prisma;

const scheduleListInclude = {
  pipeline: { select: { id: true, name: true } },
  createdBy: { select: { id: true, name: true, email: true } },
} as const;

export type SchedulesPageResult = {
  schedules: Prisma.ScheduleGetPayload<{
    include: typeof scheduleListInclude;
  }>[];
  total: number;
  page: number;
  pageSize: number;
};

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

export const getScheduleById = async (
  scheduleId: string,
  db: Db = prisma,
): Promise<Prisma.ScheduleGetPayload<{
  include: {
    pipeline: true;
    createdBy: { select: { id: true; name: true; email: true } };
  };
}> | null> => {
  return db.schedule.findUnique({
    where: { id: scheduleId },
    include: {
      pipeline: true,
      createdBy: { select: { id: true, name: true, email: true } },
    },
  });
};

export type ScheduleExecutionsPageResult = {
  executions: PipelineExecutionRow[];
  total: number;
  page: number;
  pageSize: number;
};

export const getScheduleExecutionsPage = async (
  scheduleId: string,
  page: number,
  pageSize: number,
  db: Db = prisma,
): Promise<ScheduleExecutionsPageResult> => {
  const skip = (page - 1) * pageSize;
  const where = { scheduleId } satisfies Prisma.ScheduleExecutionWhereInput;
  const executionsQuery = {
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
      createdAt: true,
    },
  } satisfies Prisma.ScheduleExecutionFindManyArgs;
  const [executions, total] = await Promise.all([
    db.scheduleExecution.findMany(executionsQuery),
    db.scheduleExecution.count({ where }),
  ]);
  const sourceRows = executions.map((execution) => ({
    ...execution,
    source: "schedule" as const,
    sourceId: scheduleId,
    sourceName: null,
  }));
  const executionsWithElapsed = await attachExecutionElapsedLabels(
    sourceRows,
    db,
  );

  return { executions: executionsWithElapsed, total, page, pageSize };
};

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
    metadata: unknown | null;
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
    params: unknown;
    invocationConfig: unknown | null;
    error: unknown;
    agentResponse: unknown;
    semanticStatus: string | null;
    enqueuedAt: Date;
    startedAt: Date | null;
    completedAt: Date | null;
    dataQueueAttempts: number | null;
    dataQueueMaxAttempts: number | null;
  }>;
};

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
          params: true,
          invocationConfig: true,
          error: true,
          agentResponse: true,
          semanticStatus: true,
          enqueuedAt: true,
          startedAt: true,
          completedAt: true,
          dataQueueAttempts: true,
          dataQueueMaxAttempts: true,
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
      metadata: row.metadata,
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
      params: j.params,
      invocationConfig: j.invocationConfig,
      error: j.error,
      agentResponse: j.agentResponse,
      semanticStatus: j.semanticStatus,
      enqueuedAt: j.enqueuedAt,
      startedAt: j.startedAt,
      completedAt: j.completedAt,
      dataQueueAttempts: j.dataQueueAttempts,
      dataQueueMaxAttempts: j.dataQueueMaxAttempts,
    })),
  };
};

export type ScheduleExecutionSummary = Omit<
  ScheduleExecutionDetail,
  "execution" | "invocations"
> & {
  execution: ExecutionSummary;
  invocations: InvocationSummary[];
};

export const getScheduleExecutionSummary = async (
  scheduleId: string,
  executionId: string,
  db: Db = prisma,
): Promise<ScheduleExecutionSummary | null> => {
  const summaryQuery = {
    where: { id: executionId, scheduleId },
    select: {
      ...executionSummarySelect,
      schedule: {
        select: {
          id: true,
          name: true,
          pipeline: { select: { id: true, name: true } },
        },
      },
      scheduleStepExecutions: { select: stepExecutionSummarySelect },
      agentJobExecutions: {
        orderBy: { enqueuedAt: "asc" },
        select: invocationSummarySelect,
      },
    },
  } satisfies Prisma.ScheduleExecutionFindFirstArgs;
  const row = await db.scheduleExecution.findFirst(summaryQuery);
  if (!row) {
    return null;
  }

  return {
    execution: toExecutionSummary(row),
    pipeline: row.schedule.pipeline,
    schedule: { id: row.schedule.id, name: row.schedule.name },
    stepExecutions: toStepExecutionSummaries(row.scheduleStepExecutions),
    invocations: row.agentJobExecutions.map(toInvocationSummary),
  };
};
