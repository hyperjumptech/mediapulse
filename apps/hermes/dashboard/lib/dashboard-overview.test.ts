/** @vitest-environment node */
import { describe, expect, it, vi } from "vitest";

import {
  buildExecutionHref,
  getActiveExecutions,
  getExecutionStatusCounts,
  getRecentFailures,
  getUpcomingSchedules,
  type ExecutionStatusCountsDb,
  type HttpTriggerExecutionOverviewRow,
  type ManualPipelineExecutionOverviewRow,
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
  executionTime: new Date("2026-09-28T09:00:00.000Z"),
  pipeline: { id: "pipeline-3", name: "Backfill" },
  ...overrides,
});

describe("buildExecutionHref", () => {
  it("builds the schedule execution detail path", () => {
    // Act
    const href = buildExecutionHref("schedule", "schedule-1", "execution-1");

    // Assert
    expect(href).toBe("/dashboard/schedules/schedule-1/executions/execution-1");
  });

  it("builds the HTTP trigger execution detail path", () => {
    // Act
    const href = buildExecutionHref("httpTrigger", "trigger-1", "execution-1");

    // Assert
    expect(href).toBe(
      "/dashboard/http-triggers/trigger-1/executions/execution-1",
    );
  });

  it("builds the manual pipeline execution detail path", () => {
    // Act
    const href = buildExecutionHref("manual", "pipeline-1", "execution-1");

    // Assert
    expect(href).toBe("/dashboard/pipelines/pipeline-1/executions/execution-1");
  });
});

describe("getExecutionStatusCounts", () => {
  it("groups each execution table by run status within the window", async () => {
    // Setup
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

    // Act
    await getExecutionStatusCounts(since, db);

    // Assert
    expect(scheduleGroupBy).toHaveBeenCalledWith(expectedArgs);
    expect(httpTriggerGroupBy).toHaveBeenCalledWith(expectedArgs);
    expect(manualGroupBy).toHaveBeenCalledWith(expectedArgs);
  });

  it("merges the three tables into running, succeeded, failed, and cancelled buckets", async () => {
    // Setup
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

    // Act
    const counts = await getExecutionStatusCounts(new Date(), db);

    // Assert
    expect(counts).toEqual({
      total: 31,
      running: 5,
      succeeded: 15,
      failed: 5,
      cancelled: 6,
    });
  });

  it("returns zero counts when no executions ran in the window", async () => {
    // Setup
    const { db } = createStatusCountsDb({});

    // Act
    const counts = await getExecutionStatusCounts(new Date(), db);

    // Assert
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
    // Setup
    const { db, scheduleFindMany, httpTriggerFindMany, manualFindMany } =
      createExecutionsDb({});
    const expectedQuery = {
      where: { runStatus: { in: ["pending", "running"] } },
      orderBy: { executionTime: "desc" },
      take: 10,
    };

    // Act
    await getActiveExecutions(undefined, db);

    // Assert
    expect(scheduleFindMany).toHaveBeenCalledWith({
      ...expectedQuery,
      select: {
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
      },
    });
    expect(httpTriggerFindMany).toHaveBeenCalledWith({
      ...expectedQuery,
      select: {
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
      },
    });
    expect(manualFindMany).toHaveBeenCalledWith({
      ...expectedQuery,
      select: {
        id: true,
        runStatus: true,
        executionTime: true,
        pipeline: { select: { id: true, name: true } },
      },
    });
  });

  it("merges the tables, sorts by execution time descending, and keeps the limit", async () => {
    // Setup
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

    // Act
    const executions = await getActiveExecutions(3, db);

    // Assert
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

  it("maps each table row to an overview execution with an exact detail link", async () => {
    // Setup
    const { db } = createExecutionsDb({
      schedule: [scheduleExecutionRow()],
      httpTrigger: [httpTriggerExecutionRow()],
      manual: [manualPipelineExecutionRow()],
    });

    // Act
    const executions = await getActiveExecutions(10, db);

    // Assert
    expect(executions).toEqual([
      {
        kind: "httpTrigger",
        executionId: "http-trigger-execution-1",
        parentId: "http-trigger-1",
        parentName: "Inbound webhook",
        pipelineId: "pipeline-2",
        pipelineName: "Ingest",
        runStatus: "pending",
        executionTime: new Date("2026-09-28T11:00:00.000Z"),
        href: "/dashboard/http-triggers/http-trigger-1/executions/http-trigger-execution-1",
      },
      {
        kind: "schedule",
        executionId: "schedule-execution-1",
        parentId: "schedule-1",
        parentName: "Morning digest",
        pipelineId: "pipeline-1",
        pipelineName: "Newsletter",
        runStatus: "running",
        executionTime: new Date("2026-09-28T10:00:00.000Z"),
        href: "/dashboard/schedules/schedule-1/executions/schedule-execution-1",
      },
      {
        kind: "manual",
        executionId: "manual-execution-1",
        parentId: "pipeline-3",
        parentName: "Backfill",
        pipelineId: "pipeline-3",
        pipelineName: "Backfill",
        runStatus: "running",
        executionTime: new Date("2026-09-28T09:00:00.000Z"),
        href: "/dashboard/pipelines/pipeline-3/executions/manual-execution-1",
      },
    ]);
  });
});

describe("getRecentFailures", () => {
  it("queries failed and partial executions since the given date", async () => {
    // Setup
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

    // Act
    await getRecentFailures(since, undefined, db);

    // Assert
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
    // Setup
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

    // Act
    const executions = await getRecentFailures(new Date(), 2, db);

    // Assert
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
    // Setup
    const { db, scheduleFindMany } = createUpcomingSchedulesDb([]);

    // Act
    await getUpcomingSchedules(undefined, db);

    // Assert
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
    // Setup
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

    // Act
    const schedules = await getUpcomingSchedules(5, db);

    // Assert
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
