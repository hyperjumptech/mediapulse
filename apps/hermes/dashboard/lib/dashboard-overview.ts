import {
  type Prisma,
  prisma,
  ScheduleRunStatus,
} from "@hermes/orchestration-database";

export type ExecutionStatusCounts = {
  total: number;
  running: number;
  succeeded: number;
  failed: number;
  cancelled: number;
};

export type OverviewExecutionKind = "schedule" | "httpTrigger" | "manual";

export type OverviewExecution = {
  kind: OverviewExecutionKind;
  executionId: string;
  parentId: string;
  parentName: string;
  pipelineId: string;
  pipelineName: string;
  runStatus: ScheduleRunStatus;
  executionTime: Date;
  href: string;
};

export type ExecutionStatusCountsDb = {
  scheduleExecution: Pick<typeof prisma.scheduleExecution, "groupBy">;
  httpTriggerExecution: Pick<typeof prisma.httpTriggerExecution, "groupBy">;
  manualPipelineExecution: Pick<
    typeof prisma.manualPipelineExecution,
    "groupBy"
  >;
};

export type OverviewExecutionsDb = {
  scheduleExecution: Pick<typeof prisma.scheduleExecution, "findMany">;
  httpTriggerExecution: Pick<typeof prisma.httpTriggerExecution, "findMany">;
  manualPipelineExecution: Pick<
    typeof prisma.manualPipelineExecution,
    "findMany"
  >;
};

export type UpcomingSchedulesDb = {
  schedule: Pick<typeof prisma.schedule, "findMany">;
};

type StatusCountBucket = Exclude<keyof ExecutionStatusCounts, "total">;

type ExecutionWindowWhere = {
  runStatus: { in: ScheduleRunStatus[] };
  executionTime?: { gte: Date };
};

const ALL_RUN_STATUSES = Object.values(ScheduleRunStatus);

const ACTIVE_RUN_STATUSES: ScheduleRunStatus[] = [
  ScheduleRunStatus.pending,
  ScheduleRunStatus.running,
];

const FAILED_RUN_STATUSES: ScheduleRunStatus[] = [
  ScheduleRunStatus.failed,
  ScheduleRunStatus.partial,
];

const STATUS_COUNT_BUCKET: Record<ScheduleRunStatus, StatusCountBucket> = {
  pending: "running",
  running: "running",
  succeeded: "succeeded",
  partial: "failed",
  failed: "failed",
  cancelled: "cancelled",
};

const EMPTY_STATUS_COUNTS: ExecutionStatusCounts = {
  total: 0,
  running: 0,
  succeeded: 0,
  failed: 0,
  cancelled: 0,
};

const scheduleExecutionOverviewSelect = {
  id: true,
  runStatus: true,
  executionTime: true,
  schedule: {
    select: {
      id: true,
      name: true,
      pipeline: { select: { id: true, name: true } },
    },
  },
} satisfies Prisma.ScheduleExecutionSelect;

const httpTriggerExecutionOverviewSelect = {
  id: true,
  runStatus: true,
  executionTime: true,
  httpTrigger: {
    select: {
      id: true,
      name: true,
      pipeline: { select: { id: true, name: true } },
    },
  },
} satisfies Prisma.HttpTriggerExecutionSelect;

const manualPipelineExecutionOverviewSelect = {
  id: true,
  runStatus: true,
  executionTime: true,
  pipeline: { select: { id: true, name: true } },
} satisfies Prisma.ManualPipelineExecutionSelect;

const upcomingScheduleSelect = {
  id: true,
  name: true,
  nextRunAt: true,
  pipeline: { select: { id: true, name: true, isActive: true } },
} satisfies Prisma.ScheduleSelect;

export type ScheduleExecutionOverviewRow = Prisma.ScheduleExecutionGetPayload<{
  select: typeof scheduleExecutionOverviewSelect;
}>;

export type HttpTriggerExecutionOverviewRow =
  Prisma.HttpTriggerExecutionGetPayload<{
    select: typeof httpTriggerExecutionOverviewSelect;
  }>;

export type ManualPipelineExecutionOverviewRow =
  Prisma.ManualPipelineExecutionGetPayload<{
    select: typeof manualPipelineExecutionOverviewSelect;
  }>;

export type UpcomingScheduleRow = Prisma.ScheduleGetPayload<{
  select: typeof upcomingScheduleSelect;
}>;

export type UpcomingSchedule = Omit<UpcomingScheduleRow, "nextRunAt"> & {
  nextRunAt: Date;
};

export const buildExecutionHref = (
  kind: OverviewExecutionKind,
  parentId: string,
  executionId: string,
): string => {
  if (kind === "schedule") {
    return `/dashboard/schedules/${parentId}/executions/${executionId}`;
  }
  if (kind === "httpTrigger") {
    return `/dashboard/http-triggers/${parentId}/executions/${executionId}`;
  }

  return `/dashboard/pipelines/${parentId}/executions/${executionId}`;
};

const fromScheduleExecution = (
  row: ScheduleExecutionOverviewRow,
): OverviewExecution => ({
  kind: "schedule",
  executionId: row.id,
  parentId: row.schedule.id,
  parentName: row.schedule.name,
  pipelineId: row.schedule.pipeline.id,
  pipelineName: row.schedule.pipeline.name,
  runStatus: row.runStatus,
  executionTime: row.executionTime,
  href: buildExecutionHref("schedule", row.schedule.id, row.id),
});

const fromHttpTriggerExecution = (
  row: HttpTriggerExecutionOverviewRow,
): OverviewExecution => ({
  kind: "httpTrigger",
  executionId: row.id,
  parentId: row.httpTrigger.id,
  parentName: row.httpTrigger.name,
  pipelineId: row.httpTrigger.pipeline.id,
  pipelineName: row.httpTrigger.pipeline.name,
  runStatus: row.runStatus,
  executionTime: row.executionTime,
  href: buildExecutionHref("httpTrigger", row.httpTrigger.id, row.id),
});

const fromManualPipelineExecution = (
  row: ManualPipelineExecutionOverviewRow,
): OverviewExecution => ({
  kind: "manual",
  executionId: row.id,
  parentId: row.pipeline.id,
  parentName: row.pipeline.name,
  pipelineId: row.pipeline.id,
  pipelineName: row.pipeline.name,
  runStatus: row.runStatus,
  executionTime: row.executionTime,
  href: buildExecutionHref("manual", row.pipeline.id, row.id),
});

const byExecutionTimeDescending = (
  left: OverviewExecution,
  right: OverviewExecution,
): number => right.executionTime.getTime() - left.executionTime.getTime();

const findOverviewExecutions = async (
  where: ExecutionWindowWhere,
  limit: number,
  db: OverviewExecutionsDb,
): Promise<OverviewExecution[]> => {
  const scheduleArgs = {
    where,
    orderBy: { executionTime: "desc" },
    take: limit,
    select: scheduleExecutionOverviewSelect,
  } satisfies Prisma.ScheduleExecutionFindManyArgs;
  const httpTriggerArgs = {
    where,
    orderBy: { executionTime: "desc" },
    take: limit,
    select: httpTriggerExecutionOverviewSelect,
  } satisfies Prisma.HttpTriggerExecutionFindManyArgs;
  const manualArgs = {
    where,
    orderBy: { executionTime: "desc" },
    take: limit,
    select: manualPipelineExecutionOverviewSelect,
  } satisfies Prisma.ManualPipelineExecutionFindManyArgs;
  const [scheduleRows, httpTriggerRows, manualRows] = await Promise.all([
    db.scheduleExecution.findMany(scheduleArgs),
    db.httpTriggerExecution.findMany(httpTriggerArgs),
    db.manualPipelineExecution.findMany(manualArgs),
  ]);
  const executions = [
    ...scheduleRows.map(fromScheduleExecution),
    ...httpTriggerRows.map(fromHttpTriggerExecution),
    ...manualRows.map(fromManualPipelineExecution),
  ];

  return executions.sort(byExecutionTimeDescending).slice(0, limit);
};

export const getExecutionStatusCounts = async (
  since: Date,
  db: ExecutionStatusCountsDb = prisma,
): Promise<ExecutionStatusCounts> => {
  const where = {
    runStatus: { in: ALL_RUN_STATUSES },
    executionTime: { gte: since },
  };
  const scheduleArgs = {
    by: ["runStatus"],
    where,
    _count: { _all: true },
  } satisfies Prisma.ScheduleExecutionGroupByArgs;
  const httpTriggerArgs = {
    by: ["runStatus"],
    where,
    _count: { _all: true },
  } satisfies Prisma.HttpTriggerExecutionGroupByArgs;
  const manualArgs = {
    by: ["runStatus"],
    where,
    _count: { _all: true },
  } satisfies Prisma.ManualPipelineExecutionGroupByArgs;
  const [scheduleGroups, httpTriggerGroups, manualGroups] = await Promise.all([
    db.scheduleExecution.groupBy(scheduleArgs),
    db.httpTriggerExecution.groupBy(httpTriggerArgs),
    db.manualPipelineExecution.groupBy(manualArgs),
  ]);
  const statusGroups = [
    ...scheduleGroups,
    ...httpTriggerGroups,
    ...manualGroups,
  ];

  return statusGroups.reduce<ExecutionStatusCounts>((counts, statusGroup) => {
    const bucket = STATUS_COUNT_BUCKET[statusGroup.runStatus];
    const groupCount = statusGroup._count._all;

    return {
      ...counts,
      total: counts.total + groupCount,
      [bucket]: counts[bucket] + groupCount,
    };
  }, EMPTY_STATUS_COUNTS);
};

export const getActiveExecutions = async (
  limit = 10,
  db: OverviewExecutionsDb = prisma,
): Promise<OverviewExecution[]> => {
  const where = { runStatus: { in: ACTIVE_RUN_STATUSES } };

  return findOverviewExecutions(where, limit, db);
};

export const getRecentFailures = async (
  since: Date,
  limit = 8,
  db: OverviewExecutionsDb = prisma,
): Promise<OverviewExecution[]> => {
  const where = {
    runStatus: { in: FAILED_RUN_STATUSES },
    executionTime: { gte: since },
  };

  return findOverviewExecutions(where, limit, db);
};

export const getUpcomingSchedules = async (
  limit = 8,
  db: UpcomingSchedulesDb = prisma,
): Promise<UpcomingSchedule[]> => {
  const args = {
    where: { enabled: true, nextRunAt: { not: null } },
    orderBy: { nextRunAt: "asc" },
    take: limit,
    select: upcomingScheduleSelect,
  } satisfies Prisma.ScheduleFindManyArgs;
  const rows = await db.schedule.findMany(args);

  return rows.flatMap((row) =>
    row.nextRunAt ? [{ ...row, nextRunAt: row.nextRunAt }] : [],
  );
};
