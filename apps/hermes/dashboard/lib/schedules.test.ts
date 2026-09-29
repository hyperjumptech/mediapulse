/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getScheduleById,
  getScheduleExecutionSummary,
  getScheduleExecutionsPage,
  getSchedulesPage,
} from "./schedules";
import type { PrismaClientWithSchema } from "@hermes/orchestration-database/client";

type MockDb = {
  schedule: {
    findMany: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
  };
  scheduleExecution: {
    findMany: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
  };
  agentJobExecution: {
    findMany: ReturnType<typeof vi.fn>;
  };
};

const createMockDb = (): MockDb => ({
  schedule: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    count: vi.fn(),
  },
  scheduleExecution: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    count: vi.fn(),
  },
  agentJobExecution: {
    findMany: vi.fn(),
  },
});

const asDb = (db: MockDb): PrismaClientWithSchema =>
  db as unknown as PrismaClientWithSchema;

describe("getSchedulesPage", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls findMany and count with default sort and no search when options omitted", async () => {
    const db = createMockDb();
    db.schedule.findMany.mockResolvedValue([]);
    db.schedule.count.mockResolvedValue(0);

    await getSchedulesPage(1, 10, undefined, asDb(db));

    expect(db.schedule.findMany).toHaveBeenCalledWith({
      where: undefined,
      skip: 0,
      take: 10,
      orderBy: { name: "asc" },
      include: {
        pipeline: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true, email: true } },
      },
    });
    expect(db.schedule.count).toHaveBeenCalledWith({ where: undefined });
  });

  it("applies search where clause when search option provided", async () => {
    const db = createMockDb();
    db.schedule.findMany.mockResolvedValue([]);
    db.schedule.count.mockResolvedValue(0);

    await getSchedulesPage(1, 5, { search: "daily" }, asDb(db));

    expect(db.schedule.findMany).toHaveBeenCalledWith({
      where: {
        OR: [
          { name: { contains: "daily", mode: "insensitive" } },
          { description: { contains: "daily", mode: "insensitive" } },
        ],
      },
      skip: 0,
      take: 5,
      orderBy: { name: "asc" },
      include: {
        pipeline: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true, email: true } },
      },
    });
    expect(db.schedule.count).toHaveBeenCalledWith({
      where: {
        OR: [
          { name: { contains: "daily", mode: "insensitive" } },
          { description: { contains: "daily", mode: "insensitive" } },
        ],
      },
    });
  });

  it("uses sortBy nextRunAt and sortDir desc when specified", async () => {
    const db = createMockDb();
    db.schedule.findMany.mockResolvedValue([]);
    db.schedule.count.mockResolvedValue(0);

    await getSchedulesPage(
      2,
      15,
      { sortBy: "nextRunAt", sortDir: "desc" },
      asDb(db),
    );

    expect(db.schedule.findMany).toHaveBeenCalledWith({
      where: undefined,
      skip: 15,
      take: 15,
      orderBy: { nextRunAt: "desc" },
      include: {
        pipeline: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true, email: true } },
      },
    });
  });

  it("uses sortBy created and sortBy enabled when specified", async () => {
    const db = createMockDb();
    db.schedule.findMany.mockResolvedValue([]);
    db.schedule.count.mockResolvedValue(0);

    await getSchedulesPage(
      1,
      10,
      { sortBy: "created", sortDir: "desc" },
      asDb(db),
    );

    expect(db.schedule.findMany).toHaveBeenCalledWith({
      where: undefined,
      skip: 0,
      take: 10,
      orderBy: { createdAt: "desc" },
      include: {
        pipeline: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true, email: true } },
      },
    });

    db.schedule.findMany.mockClear();
    await getSchedulesPage(
      1,
      10,
      { sortBy: "enabled", sortDir: "asc" },
      asDb(db),
    );
    expect(db.schedule.findMany).toHaveBeenCalledWith({
      where: undefined,
      skip: 0,
      take: 10,
      orderBy: { enabled: "asc" },
      include: {
        pipeline: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true, email: true } },
      },
    });
  });

  it("returns schedules, total, page, and pageSize", async () => {
    const db = createMockDb();
    const schedules = [
      {
        id: "s1",
        name: "Daily run",
        description: "Runs daily",
        repeat: "repeating" as const,
        cronExpression: "0 6 * * *",
        interval: null,
        timezone: "UTC",
        startAt: null,
        nextRunAt: new Date(),
        pipelineId: "p1",
        params: {},
        retryConfig: null,
        priority: 0,
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: null,
        pipeline: { id: "p1", name: "Main pipeline" },
      },
    ];
    db.schedule.findMany.mockResolvedValue(schedules);
    db.schedule.count.mockResolvedValue(1);

    const result = await getSchedulesPage(1, 10, undefined, asDb(db));

    expect(result).toEqual({
      schedules,
      total: 1,
      page: 1,
      pageSize: 10,
    });
  });
});

describe("getScheduleById", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls findUnique with id and include pipeline", async () => {
    const db = createMockDb();
    db.schedule.findUnique.mockResolvedValue(null);

    await getScheduleById("schedule-uuid-1", asDb(db));

    expect(db.schedule.findUnique).toHaveBeenCalledWith({
      where: { id: "schedule-uuid-1" },
      include: {
        pipeline: true,
        createdBy: { select: { id: true, name: true, email: true } },
      },
    });
  });

  it("returns the schedule with pipeline when found", async () => {
    const db = createMockDb();
    const schedule = {
      id: "schedule-uuid-1",
      name: "Test",
      description: null,
      repeat: "once" as const,
      cronExpression: null,
      interval: null,
      timezone: "America/New_York",
      startAt: new Date(),
      nextRunAt: new Date(),
      pipelineId: "p1",
      params: {},
      retryConfig: null,
      priority: 0,
      enabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: null,
      pipeline: {
        id: "p1",
        name: "Pipeline",
        description: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    };
    db.schedule.findUnique.mockResolvedValue(schedule);

    const result = await getScheduleById("schedule-uuid-1", asDb(db));

    expect(result).toEqual(schedule);
  });

  it("returns null when not found", async () => {
    const db = createMockDb();
    db.schedule.findUnique.mockResolvedValue(null);

    const result = await getScheduleById("missing-id", asDb(db));

    expect(result).toBeNull();
  });
});

describe("getScheduleExecutionsPage", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls findMany and count with scheduleId, orderBy executionTime desc, skip and take", async () => {
    const db = createMockDb();
    db.scheduleExecution.findMany.mockResolvedValue([]);
    db.scheduleExecution.count.mockResolvedValue(0);

    await getScheduleExecutionsPage("sched-1", 1, 15, asDb(db));

    expect(db.scheduleExecution.findMany).toHaveBeenCalledWith({
      where: { scheduleId: "sched-1" },
      skip: 0,
      take: 15,
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
    });
    expect(db.scheduleExecution.count).toHaveBeenCalledWith({
      where: { scheduleId: "sched-1" },
    });
  });

  it("uses correct skip for page 2", async () => {
    const db = createMockDb();
    db.scheduleExecution.findMany.mockResolvedValue([]);
    db.scheduleExecution.count.mockResolvedValue(50);

    await getScheduleExecutionsPage("sched-1", 2, 10, asDb(db));

    expect(db.scheduleExecution.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 10, take: 10 }),
    );
  });

  it("tags each execution with its schedule and a duration from its jobs", async () => {
    const db = createMockDb();
    const execution = {
      id: "ex-1",
      executionTime: new Date("2025-01-15T10:00:00Z"),
      enqueueStatus: "success",
      runStatus: "succeeded",
      jobsCreated: 3,
      jobsEnqueued: 3,
      succeededInvocationCount: 3,
      failedInvocationCount: 0,
      createdAt: new Date("2025-01-15T10:00:01Z"),
    };
    db.scheduleExecution.findMany.mockResolvedValue([execution]);
    db.scheduleExecution.count.mockResolvedValue(1);
    db.agentJobExecution.findMany.mockResolvedValue([
      {
        scheduleExecutionId: "ex-1",
        httpTriggerExecutionId: null,
        manualExecutionId: null,
        enqueuedAt: new Date("2025-01-15T10:00:00Z"),
        startedAt: new Date("2025-01-15T10:00:05Z"),
        completedAt: new Date("2025-01-15T10:02:15Z"),
      },
    ]);

    const result = await getScheduleExecutionsPage("sched-1", 1, 10, asDb(db));

    expect(db.agentJobExecution.findMany).toHaveBeenCalledTimes(1);
    expect(db.agentJobExecution.findMany).toHaveBeenCalledWith({
      where: { OR: [{ scheduleExecutionId: { in: ["ex-1"] } }] },
      select: {
        scheduleExecutionId: true,
        httpTriggerExecutionId: true,
        manualExecutionId: true,
        enqueuedAt: true,
        startedAt: true,
        completedAt: true,
      },
    });
    expect(result).toEqual({
      executions: [
        {
          ...execution,
          source: "schedule",
          sourceId: "sched-1",
          sourceName: null,
          elapsedLabel: "2m 10s",
        },
      ],
      total: 1,
      page: 1,
      pageSize: 10,
    });
  });

  it("skips the job lookup when the page is empty", async () => {
    const db = createMockDb();
    db.scheduleExecution.findMany.mockResolvedValue([]);
    db.scheduleExecution.count.mockResolvedValue(0);

    const result = await getScheduleExecutionsPage("sched-1", 1, 10, asDb(db));

    expect(db.agentJobExecution.findMany).not.toHaveBeenCalled();
    expect(result.executions).toEqual([]);
  });
});

describe("getScheduleExecutionSummary", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const summaryRow = () => ({
    id: "exec-1",
    executionTime: new Date("2026-04-21T12:00:00.000Z"),
    enqueueStatus: "success",
    runStatus: "failed",
    effectiveExecutionConfig: null,
    jobsCreated: 2,
    jobsEnqueued: 2,
    succeededInvocationCount: 1,
    failedInvocationCount: 1,
    errors: null,
    metadata: null,
    createdAt: new Date("2026-04-21T12:00:00.000Z"),
    schedule: {
      id: "sched-1",
      name: "Nightly",
      pipeline: { id: "pipe-1", name: "Pipeline" },
    },
    scheduleStepExecutions: [
      {
        pipelineStepId: "step-2",
        position: 1,
        expectedInvocationCount: 1,
        succeededCount: 0,
        failedCount: 1,
        rollupStatus: "failed",
        pipelineStep: {
          order: 0,
          agentId: "agent-b",
          agentVersion: "1.0.0",
          pipelineId: "pipe-child",
          pipeline: { name: "Child" },
        },
      },
      {
        pipelineStepId: "step-1",
        position: 0,
        expectedInvocationCount: 1,
        succeededCount: 1,
        failedCount: 0,
        rollupStatus: "success",
        pipelineStep: {
          order: 0,
          agentId: "agent-a",
          agentVersion: "1.0.0",
          pipelineId: "pipe-1",
          pipeline: { name: "Pipeline" },
        },
      },
    ],
    agentJobExecutions: [
      {
        jobId: "job-1",
        status: "failed",
        semanticStatus: null,
        agentId: "agent-b",
        error: { message: "Upstream timed out" },
        agentResponse: null,
        enqueuedAt: new Date("2026-04-21T12:00:00.000Z"),
        startedAt: new Date("2026-04-21T12:00:01.000Z"),
        completedAt: new Date("2026-04-21T12:00:05.000Z"),
        dataQueueAttempts: 3,
        dataQueueMaxAttempts: 3,
      },
    ],
  });

  it("loads the execution, pipeline, steps and job summaries in one query", async () => {
    const db = createMockDb();
    db.scheduleExecution.findFirst.mockResolvedValue(summaryRow());

    await getScheduleExecutionSummary("sched-1", "exec-1", asDb(db));

    expect(db.scheduleExecution.findFirst).toHaveBeenCalledTimes(1);
    expect(db.schedule.findUnique).not.toHaveBeenCalled();
    expect(db.scheduleExecution.findFirst).toHaveBeenCalledWith({
      where: { id: "exec-1", scheduleId: "sched-1" },
      select: {
        id: true,
        executionTime: true,
        enqueueStatus: true,
        runStatus: true,
        effectiveExecutionConfig: true,
        jobsCreated: true,
        jobsEnqueued: true,
        succeededInvocationCount: true,
        failedInvocationCount: true,
        errors: true,
        metadata: true,
        createdAt: true,
        schedule: {
          select: {
            id: true,
            name: true,
            pipeline: { select: { id: true, name: true } },
          },
        },
        scheduleStepExecutions: {
          select: {
            pipelineStepId: true,
            position: true,
            expectedInvocationCount: true,
            succeededCount: true,
            failedCount: true,
            rollupStatus: true,
            pipelineStep: {
              select: {
                order: true,
                agentId: true,
                agentVersion: true,
                pipelineId: true,
                pipeline: { select: { name: true } },
              },
            },
          },
        },
        agentJobExecutions: {
          orderBy: { enqueuedAt: "asc" },
          select: {
            jobId: true,
            status: true,
            semanticStatus: true,
            agentId: true,
            error: true,
            agentResponse: true,
            enqueuedAt: true,
            startedAt: true,
            completedAt: true,
            dataQueueAttempts: true,
            dataQueueMaxAttempts: true,
          },
        },
      },
    });
  });

  it("returns scalar invocation rows with a server-computed outcome summary", async () => {
    const db = createMockDb();
    db.scheduleExecution.findFirst.mockResolvedValue(summaryRow());

    const summary = await getScheduleExecutionSummary(
      "sched-1",
      "exec-1",
      asDb(db),
    );

    expect(summary?.pipeline).toEqual({ id: "pipe-1", name: "Pipeline" });
    expect(summary?.schedule).toEqual({ id: "sched-1", name: "Nightly" });
    expect(summary?.stepExecutions).toEqual([
      {
        pipelineStepId: "step-1",
        stepOrder: 0,
        agentId: "agent-a",
        agentVersion: "1.0.0",
        sourcePipelineName: null,
        expectedInvocationCount: 1,
        succeededCount: 1,
        failedCount: 0,
        rollupStatus: "success",
      },
      {
        pipelineStepId: "step-2",
        stepOrder: 1,
        agentId: "agent-b",
        agentVersion: "1.0.0",
        sourcePipelineName: "Child",
        expectedInvocationCount: 1,
        succeededCount: 0,
        failedCount: 1,
        rollupStatus: "failed",
      },
    ]);
    expect(summary?.invocations).toEqual([
      {
        jobId: "job-1",
        status: "failed",
        semanticStatus: null,
        agentId: "agent-b",
        outcomeSummary: "Upstream timed out",
        enqueuedAt: new Date("2026-04-21T12:00:00.000Z"),
        startedAt: new Date("2026-04-21T12:00:01.000Z"),
        completedAt: new Date("2026-04-21T12:00:05.000Z"),
        dataQueueAttempts: 3,
        dataQueueMaxAttempts: 3,
      },
    ]);
    expect(summary?.execution).not.toHaveProperty("schedule");
  });

  it("returns null when the execution does not belong to the schedule", async () => {
    const db = createMockDb();
    db.scheduleExecution.findFirst.mockResolvedValue(null);

    const summary = await getScheduleExecutionSummary(
      "other-schedule",
      "exec-1",
      asDb(db),
    );

    expect(summary).toBeNull();
  });
});
