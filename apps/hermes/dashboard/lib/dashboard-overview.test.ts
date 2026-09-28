/** @vitest-environment node */
import { describe, expect, it, vi } from "vitest";

import {
  getActiveExecutions,
  getExecutionDailySeries,
  getExecutionStatusCounts,
  getExecutionStatusCountsInWindow,
  getOverviewActivity,
  getRecentFailures,
  getUpcomingSchedules,
  toExecutionListRow,
  type ExecutionDailySeriesDb,
  type ExecutionStatusCountsDb,
  type HttpTriggerExecutionOverviewRow,
  type ManualPipelineExecutionOverviewRow,
  type OverviewActivityDb,
  type OverviewExecution,
  type OverviewExecutionsDb,
  type ScheduleExecutionOverviewRow,
  type UpcomingScheduleRow,
  type UpcomingSchedulesDb,
} from "./dashboard-overview";

type StatusGroup = {
  runStatus: ScheduleExecutionOverviewRow["runStatus"];
  _count: { _all: number };
};

const ALL_RUN_STATUSES = [
  "pending",
  "running",
  "succeeded",
  "partial",
  "failed",
  "cancelled",
];

const createStatusCountsDb = (groups: {
  schedule?: StatusGroup[];
  httpTrigger?: StatusGroup[];
  manual?: StatusGroup[];
}) => {
  const scheduleGroupBy = vi.fn().mockResolvedValue(groups.schedule ?? []);
  const httpTriggerGroupBy = vi
    .fn()
    .mockResolvedValue(groups.httpTrigger ?? []);
  const manualGroupBy = vi.fn().mockResolvedValue(groups.manual ?? []);
  const db = {
    scheduleExecution: { groupBy: scheduleGroupBy },
    httpTriggerExecution: { groupBy: httpTriggerGroupBy },
    manualPipelineExecution: { groupBy: manualGroupBy },
  } as unknown as ExecutionStatusCountsDb;

  return { db, scheduleGroupBy, httpTriggerGroupBy, manualGroupBy };
};

const createExecutionsDb = (rows: {
  schedule?: ScheduleExecutionOverviewRow[];
  httpTrigger?: HttpTriggerExecutionOverviewRow[];
  manual?: ManualPipelineExecutionOverviewRow[];
}) => {
  const scheduleFindMany = vi.fn().mockResolvedValue(rows.schedule ?? []);
  const httpTriggerFindMany = vi.fn().mockResolvedValue(rows.httpTrigger ?? []);
  const manualFindMany = vi.fn().mockResolvedValue(rows.manual ?? []);
  const db = {
    scheduleExecution: { findMany: scheduleFindMany },
    httpTriggerExecution: { findMany: httpTriggerFindMany },
    manualPipelineExecution: { findMany: manualFindMany },
  } as unknown as OverviewExecutionsDb;

  return { db, scheduleFindMany, httpTriggerFindMany, manualFindMany };
};

const createUpcomingSchedulesDb = (rows: UpcomingScheduleRow[]) => {
  const scheduleFindMany = vi.fn().mockResolvedValue(rows);
  const db = {
    schedule: { findMany: scheduleFindMany },
  } as unknown as UpcomingSchedulesDb;

  return { db, scheduleFindMany };
};

const scheduleExecutionRow = (
  overrides: Partial<ScheduleExecutionOverviewRow> = {},
): ScheduleExecutionOverviewRow => ({
  id: "schedule-execution-1",
  runStatus: "running",
  enqueueStatus: "success",
  succeededInvocationCount: 2,
  failedInvocationCount: 0,
  executionTime: new Date("2026-09-28T10:00:00.000Z"),
  schedule: {
    id: "schedule-1",
    name: "Morning digest",
    pipeline: { id: "pipeline-1", name: "Newsletter" },
  },
  ...overrides,
});

const httpTriggerExecutionRow = (
  overrides: Partial<HttpTriggerExecutionOverviewRow> = {},
): HttpTriggerExecutionOverviewRow => ({
  id: "http-trigger-execution-1",
  runStatus: "pending",
  enqueueStatus: "partial",
  succeededInvocationCount: 0,
  failedInvocationCount: 0,
  executionTime: new Date("2026-09-28T11:00:00.000Z"),
  httpTrigger: {
    id: "http-trigger-1",
    name: "Inbound webhook",
    pipeline: { id: "pipeline-2", name: "Ingest" },
  },
  ...overrides,
});

const manualPipelineExecutionRow = (
  overrides: Partial<ManualPipelineExecutionOverviewRow> = {},
): ManualPipelineExecutionOverviewRow => ({
  id: "manual-execution-1",
  runStatus: "running",
  enqueueStatus: "success",
  succeededInvocationCount: 1,
  failedInvocationCount: 1,
  executionTime: new Date("2026-09-28T09:00:00.000Z"),
  pipeline: { id: "pipeline-3", name: "Backfill" },
  ...overrides,
});

describe("getExecutionStatusCounts", () => {
  it("groups each execution table by run status within the window", async () => {
    const since = new Date("2026-09-27T12:00:00.000Z");
    const { db, scheduleGroupBy, httpTriggerGroupBy, manualGroupBy } =
      createStatusCountsDb({});
    const expectedArgs = {
      by: ["runStatus"],
      where: {
        runStatus: { in: ALL_RUN_STATUSES },
        executionTime: { gte: since },
      },
      _count: { _all: true },
    };

    await getExecutionStatusCounts(since, db);

    expect(scheduleGroupBy).toHaveBeenCalledWith(expectedArgs);
    expect(httpTriggerGroupBy).toHaveBeenCalledWith(expectedArgs);
    expect(manualGroupBy).toHaveBeenCalledWith(expectedArgs);
  });

  it("merges the three tables into running, succeeded, failed, and cancelled buckets", async () => {
    const { db } = createStatusCountsDb({
      schedule: [
        { runStatus: "pending", _count: { _all: 2 } },
        { runStatus: "succeeded", _count: { _all: 10 } },
        { runStatus: "failed", _count: { _all: 1 } },
      ],
      httpTrigger: [
        { runStatus: "running", _count: { _all: 3 } },
        { runStatus: "partial", _count: { _all: 4 } },
      ],
      manual: [
        { runStatus: "succeeded", _count: { _all: 5 } },
        { runStatus: "cancelled", _count: { _all: 6 } },
      ],
    });

    const counts = await getExecutionStatusCounts(new Date(), db);

    expect(counts).toEqual({
      total: 31,
      running: 5,
      succeeded: 15,
      failed: 5,
      cancelled: 6,
    });
  });

  it("returns zero counts when no executions ran in the window", async () => {
    const { db } = createStatusCountsDb({});

    const counts = await getExecutionStatusCounts(new Date(), db);

    expect(counts).toEqual({
      total: 0,
      running: 0,
      succeeded: 0,
      failed: 0,
      cancelled: 0,
    });
  });
});

describe("getActiveExecutions", () => {
  it("queries pending and running executions newest first from each table", async () => {
    const { db, scheduleFindMany, httpTriggerFindMany, manualFindMany } =
      createExecutionsDb({});
    const expectedQuery = {
      where: { runStatus: { in: ["pending", "running"] } },
      orderBy: { executionTime: "desc" },
      take: 10,
    };

    await getActiveExecutions(undefined, db);

    expect(scheduleFindMany).toHaveBeenCalledWith({
      ...expectedQuery,
      select: {
        id: true,
        runStatus: true,
        enqueueStatus: true,
        succeededInvocationCount: true,
        failedInvocationCount: true,
        executionTime: true,
        schedule: {
          select: {
            id: true,
            name: true,
            pipeline: { select: { id: true, name: true } },
          },
        },
      },
    });
    expect(httpTriggerFindMany).toHaveBeenCalledWith({
      ...expectedQuery,
      select: {
        id: true,
        runStatus: true,
        enqueueStatus: true,
        succeededInvocationCount: true,
        failedInvocationCount: true,
        executionTime: true,
        httpTrigger: {
          select: {
            id: true,
            name: true,
            pipeline: { select: { id: true, name: true } },
          },
        },
      },
    });
    expect(manualFindMany).toHaveBeenCalledWith({
      ...expectedQuery,
      select: {
        id: true,
        runStatus: true,
        enqueueStatus: true,
        succeededInvocationCount: true,
        failedInvocationCount: true,
        executionTime: true,
        pipeline: { select: { id: true, name: true } },
      },
    });
  });

  it("merges the tables, sorts by execution time descending, and keeps the limit", async () => {
    const { db, scheduleFindMany } = createExecutionsDb({
      schedule: [
        scheduleExecutionRow({
          id: "schedule-newest",
          executionTime: new Date("2026-09-28T12:00:00.000Z"),
        }),
        scheduleExecutionRow({
          id: "schedule-oldest",
          executionTime: new Date("2026-09-28T08:00:00.000Z"),
        }),
      ],
      httpTrigger: [
        httpTriggerExecutionRow({
          id: "trigger-middle",
          executionTime: new Date("2026-09-28T11:00:00.000Z"),
        }),
      ],
      manual: [
        manualPipelineExecutionRow({
          id: "manual-later",
          executionTime: new Date("2026-09-28T10:00:00.000Z"),
        }),
      ],
    });

    const executions = await getActiveExecutions(3, db);

    const executionIds = executions.map((execution) => execution.executionId);

    expect(scheduleFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 3 }),
    );
    expect(executionIds).toEqual([
      "schedule-newest",
      "trigger-middle",
      "manual-later",
    ]);
  });

  it("maps each table row to an overview execution with its parent and counts", async () => {
    const { db } = createExecutionsDb({
      schedule: [scheduleExecutionRow()],
      httpTrigger: [httpTriggerExecutionRow()],
      manual: [manualPipelineExecutionRow()],
    });

    const executions = await getActiveExecutions(10, db);

    expect(executions).toEqual([
      {
        kind: "httpTrigger",
        executionId: "http-trigger-execution-1",
        parentId: "http-trigger-1",
        parentName: "Inbound webhook",
        pipelineId: "pipeline-2",
        pipelineName: "Ingest",
        runStatus: "pending",
        enqueueStatus: "partial",
        succeededInvocationCount: 0,
        failedInvocationCount: 0,
        executionTime: new Date("2026-09-28T11:00:00.000Z"),
      },
      {
        kind: "schedule",
        executionId: "schedule-execution-1",
        parentId: "schedule-1",
        parentName: "Morning digest",
        pipelineId: "pipeline-1",
        pipelineName: "Newsletter",
        runStatus: "running",
        enqueueStatus: "success",
        succeededInvocationCount: 2,
        failedInvocationCount: 0,
        executionTime: new Date("2026-09-28T10:00:00.000Z"),
      },
      {
        kind: "manual",
        executionId: "manual-execution-1",
        parentId: "pipeline-3",
        parentName: "Backfill",
        pipelineId: "pipeline-3",
        pipelineName: "Backfill",
        runStatus: "running",
        enqueueStatus: "success",
        succeededInvocationCount: 1,
        failedInvocationCount: 1,
        executionTime: new Date("2026-09-28T09:00:00.000Z"),
      },
    ]);
  });
});

describe("getRecentFailures", () => {
  it("queries failed and partial executions since the given date", async () => {
    const since = new Date("2026-09-21T12:00:00.000Z");
    const { db, scheduleFindMany, httpTriggerFindMany, manualFindMany } =
      createExecutionsDb({});
    const expectedQuery = {
      where: {
        runStatus: { in: ["failed", "partial"] },
        executionTime: { gte: since },
      },
      orderBy: { executionTime: "desc" },
      take: 8,
    };

    await getRecentFailures(since, undefined, db);

    expect(scheduleFindMany).toHaveBeenCalledWith(
      expect.objectContaining(expectedQuery),
    );
    expect(httpTriggerFindMany).toHaveBeenCalledWith(
      expect.objectContaining(expectedQuery),
    );
    expect(manualFindMany).toHaveBeenCalledWith(
      expect.objectContaining(expectedQuery),
    );
  });

  it("returns the newest failures across tables up to the limit", async () => {
    const { db } = createExecutionsDb({
      schedule: [
        scheduleExecutionRow({
          id: "schedule-failed",
          runStatus: "failed",
          executionTime: new Date("2026-09-27T08:00:00.000Z"),
        }),
      ],
      httpTrigger: [
        httpTriggerExecutionRow({
          id: "trigger-partial",
          runStatus: "partial",
          executionTime: new Date("2026-09-28T08:00:00.000Z"),
        }),
      ],
      manual: [
        manualPipelineExecutionRow({
          id: "manual-failed",
          runStatus: "failed",
          executionTime: new Date("2026-09-26T08:00:00.000Z"),
        }),
      ],
    });

    const executions = await getRecentFailures(new Date(), 2, db);

    const executionSummaries = executions.map((execution) => [
      execution.executionId,
      execution.runStatus,
    ]);

    expect(executionSummaries).toEqual([
      ["trigger-partial", "partial"],
      ["schedule-failed", "failed"],
    ]);
  });
});

describe("getUpcomingSchedules", () => {
  it("queries enabled schedules with a next run time, soonest first", async () => {
    const { db, scheduleFindMany } = createUpcomingSchedulesDb([]);

    await getUpcomingSchedules(undefined, db);

    expect(scheduleFindMany).toHaveBeenCalledWith({
      where: { enabled: true, nextRunAt: { not: null } },
      orderBy: { nextRunAt: "asc" },
      take: 8,
      select: {
        id: true,
        name: true,
        nextRunAt: true,
        pipeline: { select: { id: true, name: true, isActive: true } },
      },
    });
  });

  it("returns schedules with their pipeline and drops rows without a next run", async () => {
    const nextRunAt = new Date("2026-09-28T13:00:00.000Z");
    const { db } = createUpcomingSchedulesDb([
      {
        id: "schedule-1",
        name: "Morning digest",
        nextRunAt,
        pipeline: { id: "pipeline-1", name: "Newsletter", isActive: false },
      },
      {
        id: "schedule-2",
        name: "Orphan",
        nextRunAt: null,
        pipeline: { id: "pipeline-2", name: "Ingest", isActive: true },
      },
    ]);

    const schedules = await getUpcomingSchedules(5, db);

    expect(schedules).toEqual([
      {
        id: "schedule-1",
        name: "Morning digest",
        nextRunAt,
        pipeline: { id: "pipeline-1", name: "Newsletter", isActive: false },
      },
    ]);
  });
});

const overviewExecution = (
  overrides: Partial<OverviewExecution> = {},
): OverviewExecution => ({
  kind: "schedule",
  executionId: "schedule-execution-1",
  parentId: "schedule-1",
  parentName: "Morning digest",
  pipelineId: "pipeline-1",
  pipelineName: "Newsletter",
  runStatus: "running",
  enqueueStatus: "success",
  succeededInvocationCount: 2,
  failedInvocationCount: 1,
  executionTime: new Date("2026-09-28T10:00:00.000Z"),
  ...overrides,
});

describe("toExecutionListRow", () => {
  it("keeps the parent as the source of schedule and HTTP trigger runs", () => {
    const scheduleRow = toExecutionListRow(overviewExecution());
    const triggerRow = toExecutionListRow(
      overviewExecution({
        kind: "httpTrigger",
        parentId: "trigger-1",
        parentName: "Inbound webhook",
      }),
    );

    expect(scheduleRow).toEqual({
      id: "schedule-execution-1",
      source: "schedule",
      sourceId: "schedule-1",
      sourceName: "Morning digest",
      pipelineName: "Newsletter",
      executionTime: new Date("2026-09-28T10:00:00.000Z"),
      runStatus: "running",
      enqueueStatus: "success",
      succeededInvocationCount: 2,
      failedInvocationCount: 1,
    });
    expect(triggerRow).toMatchObject({
      source: "http-trigger",
      sourceId: "trigger-1",
      sourceName: "Inbound webhook",
    });
  });

  it("names no source for a manual run", () => {
    const manualRow = toExecutionListRow(
      overviewExecution({
        kind: "manual",
        parentId: "pipeline-3",
        parentName: "Backfill",
      }),
    );

    expect(manualRow).toMatchObject({
      source: "manual",
      sourceId: "pipeline-3",
      sourceName: null,
    });
  });
});

type ExecutionFindManyArgs = { where: { runStatus: { in: string[] } } };

type RowsByList<Row> = { running?: Row[]; failed?: Row[] };

const findManyByRunStatus = <Row>(rowsByList: RowsByList<Row>) =>
  vi.fn(async ({ where }: ExecutionFindManyArgs) =>
    where.runStatus.in.includes("running")
      ? (rowsByList.running ?? [])
      : (rowsByList.failed ?? []),
  );

const createActivityDb = (rows: {
  schedule?: RowsByList<ScheduleExecutionOverviewRow>;
  httpTrigger?: RowsByList<HttpTriggerExecutionOverviewRow>;
  upcoming?: UpcomingScheduleRow[];
  jobs?: Array<Record<string, unknown>>;
}) => {
  const scheduleExecutionFindMany = findManyByRunStatus(rows.schedule ?? {});
  const httpTriggerExecutionFindMany = findManyByRunStatus(
    rows.httpTrigger ?? {},
  );
  const manualExecutionFindMany = findManyByRunStatus({});
  const scheduleFindMany = vi.fn().mockResolvedValue(rows.upcoming ?? []);
  const agentJobFindMany = vi.fn().mockResolvedValue(rows.jobs ?? []);
  const db = {
    scheduleExecution: { findMany: scheduleExecutionFindMany },
    httpTriggerExecution: { findMany: httpTriggerExecutionFindMany },
    manualPipelineExecution: { findMany: manualExecutionFindMany },
    schedule: { findMany: scheduleFindMany },
    agentJobExecution: { findMany: agentJobFindMany },
  } as unknown as OverviewActivityDb;

  return { db, scheduleExecutionFindMany, scheduleFindMany, agentJobFindMany };
};

const upcomingScheduleRow = (index: number): UpcomingScheduleRow => ({
  id: `schedule-${index}`,
  name: `Schedule ${index}`,
  nextRunAt: new Date(`2026-09-28T1${index}:00:00.000Z`),
  pipeline: { id: "pipeline-1", name: "Newsletter", isActive: true },
});

describe("getOverviewActivity", () => {
  it("returns running and failed runs as list rows labelled from one job query", async () => {
    const { db, agentJobFindMany } = createActivityDb({
      schedule: { running: [scheduleExecutionRow()] },
      httpTrigger: {
        failed: [
          httpTriggerExecutionRow({
            runStatus: "failed",
            executionTime: new Date("2026-09-27T08:00:00.000Z"),
          }),
        ],
      },
      jobs: [
        {
          scheduleExecutionId: "schedule-execution-1",
          httpTriggerExecutionId: null,
          manualExecutionId: null,
          enqueuedAt: new Date("2026-09-28T10:00:00.000Z"),
          startedAt: new Date("2026-09-28T10:00:00.000Z"),
          completedAt: new Date("2026-09-28T10:02:00.000Z"),
        },
      ],
    });

    const activity = await getOverviewActivity(
      new Date("2026-09-21T12:00:00.000Z"),
      db,
    );

    expect(agentJobFindMany).toHaveBeenCalledTimes(1);
    expect(agentJobFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: [
            { scheduleExecutionId: { in: ["schedule-execution-1"] } },
            { httpTriggerExecutionId: { in: ["http-trigger-execution-1"] } },
          ],
        },
      }),
    );
    expect(activity.running).toEqual({
      rows: [
        expect.objectContaining({
          id: "schedule-execution-1",
          source: "schedule",
          sourceName: "Morning digest",
          pipelineName: "Newsletter",
          elapsedLabel: expect.any(String),
        }),
      ],
      hasMore: false,
    });
    expect(activity.failed.rows).toEqual([
      expect.objectContaining({
        id: "http-trigger-execution-1",
        source: "http-trigger",
        runStatus: "failed",
      }),
    ]);
  });

  it("asks each list for one extra row to tell whether more exist", async () => {
    const { db, scheduleExecutionFindMany, scheduleFindMany } =
      createActivityDb({
        upcoming: Array.from({ length: 9 }, (_, index) =>
          upcomingScheduleRow(index),
        ),
      });

    const activity = await getOverviewActivity(new Date(), db);

    expect(scheduleExecutionFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 11 }),
    );
    expect(scheduleExecutionFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 9 }),
    );
    expect(scheduleFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 9 }),
    );
    expect(activity.upcoming.rows).toHaveLength(8);
    expect(activity.upcoming.hasMore).toBe(true);
    expect(activity.failed).toEqual({ rows: [], hasMore: false });
  });
});

describe("getExecutionStatusCountsInWindow", () => {
  it("bounds the window on both sides when an end is given", async () => {
    const { db, scheduleGroupBy } = createStatusCountsDb({});
    const since = new Date("2026-09-26T12:00:00.000Z");
    const until = new Date("2026-09-27T12:00:00.000Z");

    await getExecutionStatusCountsInWindow({ since, until }, db);

    expect(scheduleGroupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          runStatus: { in: ALL_RUN_STATUSES },
          executionTime: { gte: since, lt: until },
        },
      }),
    );
  });
});

describe("getExecutionDailySeries", () => {
  type ActivityRow = { executionTime: Date; runStatus: string };

  const createSeriesDb = (rows: {
    schedule?: ActivityRow[];
    httpTrigger?: ActivityRow[];
    manual?: ActivityRow[];
  }) =>
    ({
      scheduleExecution: {
        findMany: vi.fn().mockResolvedValue(rows.schedule ?? []),
      },
      httpTriggerExecution: {
        findMany: vi.fn().mockResolvedValue(rows.httpTrigger ?? []),
      },
      manualPipelineExecution: {
        findMany: vi.fn().mockResolvedValue(rows.manual ?? []),
      },
    }) as unknown as ExecutionDailySeriesDb;

  it("counts runs and failures per calendar day in the viewer zone", async () => {
    const db = createSeriesDb({
      schedule: [
        {
          executionTime: new Date("2026-09-27T18:00:00.000Z"),
          runStatus: "succeeded",
        },
        {
          executionTime: new Date("2026-09-28T02:00:00.000Z"),
          runStatus: "failed",
        },
      ],
      httpTrigger: [
        {
          executionTime: new Date("2026-09-26T03:00:00.000Z"),
          runStatus: "partial",
        },
      ],
      manual: [
        {
          executionTime: new Date("2026-01-01T00:00:00.000Z"),
          runStatus: "failed",
        },
      ],
    });

    const series = await getExecutionDailySeries(
      {
        days: 3,
        timeZone: "Asia/Jakarta",
        now: new Date("2026-09-28T05:00:00.000Z"),
      },
      db,
    );

    expect(series).toEqual([
      { date: "2026-09-26", total: 1, failed: 1 },
      { date: "2026-09-27", total: 0, failed: 0 },
      { date: "2026-09-28", total: 2, failed: 1 },
    ]);
  });
});
