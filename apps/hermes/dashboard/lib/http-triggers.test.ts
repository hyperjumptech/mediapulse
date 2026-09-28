/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PrismaClientWithSchema } from "@hermes/orchestration-database/client";

import {
  getHttpTriggerById,
  getHttpTriggerExecutionSummary,
  getHttpTriggerExecutionsPage,
  getHttpTriggersPage,
} from "./http-triggers";

type MockDb = {
  pipeline: {
    findUnique: ReturnType<typeof vi.fn>;
  };
  httpTriggerExecution: {
    findMany: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
  };
  agentJobExecution: {
    findMany: ReturnType<typeof vi.fn>;
  };
};

const createMockDb = (): MockDb => ({
  pipeline: {
    findUnique: vi.fn(),
  },
  httpTriggerExecution: {
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

const summaryRow = () => ({
  id: "exec-1",
  executionTime: new Date("2026-04-21T12:00:00.000Z"),
  enqueueStatus: "success",
  runStatus: "succeeded",
  effectiveExecutionConfig: null,
  jobsCreated: 1,
  jobsEnqueued: 1,
  succeededInvocationCount: 1,
  failedInvocationCount: 0,
  errors: null,
  metadata: { request: { method: "POST" } },
  createdAt: new Date("2026-04-21T12:00:00.000Z"),
  httpTrigger: {
    id: "trigger-1",
    name: "Webhook",
    pipeline: { id: "pipe-1", name: "Pipeline" },
  },
  httpTriggerStepExecutions: [
    {
      pipelineStepId: "step-1",
      expectedInvocationCount: 1,
      succeededCount: 1,
      failedCount: 0,
      rollupStatus: "success",
      pipelineStep: { order: 0, agentId: "agent-a", agentVersion: "1.0.0" },
    },
  ],
  agentJobExecutions: [
    {
      jobId: "job-1",
      status: "completed",
      semanticStatus: "success",
      agentId: "agent-a",
      error: null,
      agentResponse: { status: "success", message: "Collected 4 sources" },
      enqueuedAt: new Date("2026-04-21T12:00:00.000Z"),
      startedAt: new Date("2026-04-21T12:00:01.000Z"),
      completedAt: new Date("2026-04-21T12:00:03.000Z"),
      dataQueueAttempts: 1,
      dataQueueMaxAttempts: 3,
    },
  ],
});

describe("getHttpTriggerExecutionsPage", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("selects only the columns the executions table renders", async () => {
    const db = createMockDb();
    db.httpTriggerExecution.findMany.mockResolvedValue([]);
    db.httpTriggerExecution.count.mockResolvedValue(0);

    await getHttpTriggerExecutionsPage("trigger-1", 2, 10, asDb(db));

    expect(db.httpTriggerExecution.findMany).toHaveBeenCalledWith({
      where: { httpTriggerId: "trigger-1" },
      skip: 10,
      take: 10,
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
    expect(db.httpTriggerExecution.count).toHaveBeenCalledWith({
      where: { httpTriggerId: "trigger-1" },
    });
    expect(db.agentJobExecution.findMany).not.toHaveBeenCalled();
  });

  it("tags each execution with its trigger and a duration from its jobs", async () => {
    const db = createMockDb();
    const execution = {
      id: "exec-1",
      executionTime: new Date("2026-04-21T12:00:00.000Z"),
      enqueueStatus: "success",
      runStatus: "succeeded",
      jobsCreated: 1,
      jobsEnqueued: 1,
      succeededInvocationCount: 1,
      failedInvocationCount: 0,
      createdAt: new Date("2026-04-21T12:00:00.000Z"),
    };
    db.httpTriggerExecution.findMany.mockResolvedValue([execution]);
    db.httpTriggerExecution.count.mockResolvedValue(1);
    db.agentJobExecution.findMany.mockResolvedValue([
      {
        scheduleExecutionId: null,
        httpTriggerExecutionId: "exec-1",
        manualExecutionId: null,
        enqueuedAt: new Date("2026-04-21T12:00:00.000Z"),
        startedAt: new Date("2026-04-21T12:00:01.000Z"),
        completedAt: new Date("2026-04-21T12:00:43.000Z"),
      },
    ]);

    const result = await getHttpTriggerExecutionsPage(
      "trigger-1",
      1,
      15,
      asDb(db),
    );

    expect(db.agentJobExecution.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { OR: [{ httpTriggerExecutionId: { in: ["exec-1"] } }] },
      }),
    );
    expect(result.executions).toEqual([
      {
        ...execution,
        source: "http-trigger",
        sourceId: "trigger-1",
        sourceName: null,
        elapsedLabel: "42s",
      },
    ]);
  });
});

describe("getHttpTriggerExecutionSummary", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("loads the pipeline through the trigger in the same query", async () => {
    const db = createMockDb();
    db.httpTriggerExecution.findFirst.mockResolvedValue(summaryRow());

    await getHttpTriggerExecutionSummary("trigger-1", "exec-1", asDb(db));

    expect(db.pipeline.findUnique).not.toHaveBeenCalled();
    expect(db.httpTriggerExecution.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "exec-1", httpTriggerId: "trigger-1" },
        select: expect.objectContaining({
          httpTrigger: {
            select: {
              id: true,
              name: true,
              pipeline: { select: { id: true, name: true } },
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
        }),
      }),
    );
  });

  it("returns the trigger context and scalar invocation rows", async () => {
    const db = createMockDb();
    db.httpTriggerExecution.findFirst.mockResolvedValue(summaryRow());

    const summary = await getHttpTriggerExecutionSummary(
      "trigger-1",
      "exec-1",
      asDb(db),
    );

    expect(summary?.trigger).toEqual({ id: "trigger-1", name: "Webhook" });
    expect(summary?.pipeline).toEqual({ id: "pipe-1", name: "Pipeline" });
    expect(summary?.execution.metadata).toEqual({
      request: { method: "POST" },
    });
    expect(summary?.stepExecutions).toEqual([
      {
        pipelineStepId: "step-1",
        stepOrder: 0,
        agentId: "agent-a",
        agentVersion: "1.0.0",
        expectedInvocationCount: 1,
        succeededCount: 1,
        failedCount: 0,
        rollupStatus: "success",
      },
    ]);
    expect(summary?.invocations).toEqual([
      {
        jobId: "job-1",
        status: "completed",
        semanticStatus: "success",
        agentId: "agent-a",
        outcomeSummary: "Collected 4 sources",
        enqueuedAt: new Date("2026-04-21T12:00:00.000Z"),
        startedAt: new Date("2026-04-21T12:00:01.000Z"),
        completedAt: new Date("2026-04-21T12:00:03.000Z"),
        dataQueueAttempts: 1,
        dataQueueMaxAttempts: 3,
      },
    ]);
  });

  it("returns null when the execution does not belong to the trigger", async () => {
    const db = createMockDb();
    db.httpTriggerExecution.findFirst.mockResolvedValue(null);

    const summary = await getHttpTriggerExecutionSummary(
      "other-trigger",
      "exec-1",
      asDb(db),
    );

    expect(summary).toBeNull();
  });
});

describe("HTTP trigger loaders never read the token hash", () => {
  it("omits tokenHash from the list query", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const count = vi.fn().mockResolvedValue(0);
    const db = { httpTrigger: { findMany, count } };

    await getHttpTriggersPage(
      1,
      15,
      undefined,
      db as unknown as PrismaClientWithSchema,
    );

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ omit: { tokenHash: true } }),
    );
  });

  it("omits tokenHash from the detail query", async () => {
    const findUnique = vi.fn().mockResolvedValue(null);
    const db = { httpTrigger: { findUnique } };

    await getHttpTriggerById(
      "trigger-1",
      db as unknown as PrismaClientWithSchema,
    );

    expect(findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ omit: { tokenHash: true } }),
    );
  });
});
