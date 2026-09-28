import {
  type Prisma,
  prisma,
  type ScheduleEnqueueStatus,
  ScheduleRunStatus,
} from "@hermes/orchestration-database";

import { buildTrailingDayKeys, toDayKey } from "@/lib/date-time/day-key";
import type {
  ExecutionListRow,
  ExecutionListSource,
} from "@/lib/execution-list";
import { attachExecutionElapsedLabels } from "@/lib/pipeline-executions";

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
  enqueueStatus: ScheduleEnqueueStatus;
  succeededInvocationCount: number;
  failedInvocationCount: number;
  executionTime: Date;
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

export type OverviewActivityDb = OverviewExecutionsDb &
  UpcomingSchedulesDb & {
    agentJobExecution: Pick<typeof prisma.agentJobExecution, "findMany">;
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

const executionOverviewFieldsSelect = {
  id: true,
  runStatus: true,
  enqueueStatus: true,
  succeededInvocationCount: true,
  failedInvocationCount: true,
  executionTime: true,
} as const;

const scheduleExecutionOverviewSelect = {
  ...executionOverviewFieldsSelect,
  schedule: {
    select: {
      id: true,
      name: true,
      pipeline: { select: { id: true, name: true } },
    },
  },
} satisfies Prisma.ScheduleExecutionSelect;

const httpTriggerExecutionOverviewSelect = {
  ...executionOverviewFieldsSelect,
  httpTrigger: {
    select: {
      id: true,
      name: true,
      pipeline: { select: { id: true, name: true } },
    },
  },
} satisfies Prisma.HttpTriggerExecutionSelect;

const manualPipelineExecutionOverviewSelect = {
  ...executionOverviewFieldsSelect,
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

type ExecutionOverviewFields = Pick<
  OverviewExecution,
  | "runStatus"
  | "enqueueStatus"
  | "succeededInvocationCount"
  | "failedInvocationCount"
  | "executionTime"
>;

const executionOverviewFields = (
  row: ExecutionOverviewFields,
): ExecutionOverviewFields => ({
  runStatus: row.runStatus,
  enqueueStatus: row.enqueueStatus,
  succeededInvocationCount: row.succeededInvocationCount,
  failedInvocationCount: row.failedInvocationCount,
  executionTime: row.executionTime,
});

const fromScheduleExecution = (
  row: ScheduleExecutionOverviewRow,
): OverviewExecution => ({
  kind: "schedule",
  executionId: row.id,
  parentId: row.schedule.id,
  parentName: row.schedule.name,
  pipelineId: row.schedule.pipeline.id,
  pipelineName: row.schedule.pipeline.name,
  ...executionOverviewFields(row),
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
  ...executionOverviewFields(row),
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
  ...executionOverviewFields(row),
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

export type ExecutionWindow = {
  since: Date;
  until?: Date;
};

export const getExecutionStatusCounts = async (
  since: Date,
  db: ExecutionStatusCountsDb = prisma,
): Promise<ExecutionStatusCounts> =>
  getExecutionStatusCountsInWindow({ since }, db);

export const getExecutionStatusCountsInWindow = async (
  { since, until }: ExecutionWindow,
  db: ExecutionStatusCountsDb = prisma,
): Promise<ExecutionStatusCounts> => {
  const where = {
    runStatus: { in: ALL_RUN_STATUSES },
    executionTime: until ? { gte: since, lt: until } : { gte: since },
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

const EXECUTION_LIST_SOURCE: Record<
  OverviewExecutionKind,
  ExecutionListSource
> = {
  schedule: "schedule",
  httpTrigger: "http-trigger",
  manual: "manual",
};

export const toExecutionListRow = (
  execution: OverviewExecution,
): Omit<ExecutionListRow, "elapsedLabel"> => ({
  id: execution.executionId,
  source: EXECUTION_LIST_SOURCE[execution.kind],
  sourceId: execution.parentId,
  sourceName: execution.kind === "manual" ? null : execution.parentName,
  pipelineName: execution.pipelineName,
  executionTime: execution.executionTime,
  runStatus: execution.runStatus,
  enqueueStatus: execution.enqueueStatus,
  succeededInvocationCount: execution.succeededInvocationCount,
  failedInvocationCount: execution.failedInvocationCount,
});

export const OVERVIEW_ACTIVITY_LIMITS = {
  running: 10,
  failed: 8,
  upcoming: 8,
} as const;

export type OverviewActivityList<Row> = {
  rows: Row[];
  hasMore: boolean;
};

export type OverviewActivity = {
  running: OverviewActivityList<ExecutionListRow>;
  failed: OverviewActivityList<ExecutionListRow>;
  upcoming: OverviewActivityList<UpcomingSchedule>;
};

const toActivityList = <Row>(
  rows: Row[],
  limit: number,
): OverviewActivityList<Row> => ({
  rows: rows.slice(0, limit),
  hasMore: rows.length > limit,
});

export const getOverviewActivity = async (
  failuresSince: Date,
  db: OverviewActivityDb = prisma,
): Promise<OverviewActivity> => {
  const [activeExecutions, recentFailures, upcomingSchedules] =
    await Promise.all([
      getActiveExecutions(OVERVIEW_ACTIVITY_LIMITS.running + 1, db),
      getRecentFailures(failuresSince, OVERVIEW_ACTIVITY_LIMITS.failed + 1, db),
      getUpcomingSchedules(OVERVIEW_ACTIVITY_LIMITS.upcoming + 1, db),
    ]);
  const running = toActivityList(
    activeExecutions,
    OVERVIEW_ACTIVITY_LIMITS.running,
  );
  const failed = toActivityList(
    recentFailures,
    OVERVIEW_ACTIVITY_LIMITS.failed,
  );
  const executionRows = [...running.rows, ...failed.rows].map(
    toExecutionListRow,
  );
  const executionRowsWithElapsed = await attachExecutionElapsedLabels(
    executionRows,
    db,
  );
  const runningRows = executionRowsWithElapsed.slice(0, running.rows.length);
  const failedRows = executionRowsWithElapsed.slice(running.rows.length);

  return {
    running: { rows: runningRows, hasMore: running.hasMore },
    failed: { rows: failedRows, hasMore: failed.hasMore },
    upcoming: toActivityList(
      upcomingSchedules,
      OVERVIEW_ACTIVITY_LIMITS.upcoming,
    ),
  };
};

export type ExecutionDailyPoint = {
  date: string;
  total: number;
  failed: number;
};

export type ExecutionDailySeriesDb = {
  scheduleExecution: Pick<typeof prisma.scheduleExecution, "findMany">;
  httpTriggerExecution: Pick<typeof prisma.httpTriggerExecution, "findMany">;
  manualPipelineExecution: Pick<
    typeof prisma.manualPipelineExecution,
    "findMany"
  >;
};

export type ExecutionDailySeriesInput = {
  days: number;
  timeZone: string;
  now?: Date;
};

const DAY_MILLISECONDS = 86_400_000;

const DAILY_SERIES_ROW_LIMIT = 20_000;

const executionActivitySelect = {
  executionTime: true,
  runStatus: true,
} as const;

export const getExecutionDailySeries = async (
  { days, timeZone, now = new Date() }: ExecutionDailySeriesInput,
  db: ExecutionDailySeriesDb = prisma,
): Promise<ExecutionDailyPoint[]> => {
  const since = new Date(now.getTime() - (days + 1) * DAY_MILLISECONDS);
  const where = {
    runStatus: { in: ALL_RUN_STATUSES },
    executionTime: { gte: since },
  };
  const scheduleArgs = {
    where,
    select: executionActivitySelect,
    take: DAILY_SERIES_ROW_LIMIT,
  } satisfies Prisma.ScheduleExecutionFindManyArgs;
  const httpTriggerArgs = {
    where,
    select: executionActivitySelect,
    take: DAILY_SERIES_ROW_LIMIT,
  } satisfies Prisma.HttpTriggerExecutionFindManyArgs;
  const manualArgs = {
    where,
    select: executionActivitySelect,
    take: DAILY_SERIES_ROW_LIMIT,
  } satisfies Prisma.ManualPipelineExecutionFindManyArgs;
  const [scheduleRows, httpTriggerRows, manualRows] = await Promise.all([
    db.scheduleExecution.findMany(scheduleArgs),
    db.httpTriggerExecution.findMany(httpTriggerArgs),
    db.manualPipelineExecution.findMany(manualArgs),
  ]);
  const dayKeys = buildTrailingDayKeys(toDayKey(now, timeZone), days);
  const pointsByDay = new Map<string, ExecutionDailyPoint>(
    dayKeys.map((dayKey) => [dayKey, { date: dayKey, total: 0, failed: 0 }]),
  );

  for (const row of [...scheduleRows, ...httpTriggerRows, ...manualRows]) {
    const point = pointsByDay.get(toDayKey(row.executionTime, timeZone));
    if (!point) {
      continue;
    }
    point.total += 1;
    if (FAILED_RUN_STATUSES.includes(row.runStatus)) {
      point.failed += 1;
    }
  }

  return [...pointsByDay.values()];
};
