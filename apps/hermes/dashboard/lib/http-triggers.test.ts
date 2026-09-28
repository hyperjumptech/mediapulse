/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PrismaClientWithSchema } from "@hermes/orchestration-database/client";

import {
  getHttpTriggerExecutionSummary,
  getHttpTriggerExecutionsPage,
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
    // Setup
    const db = createMockDb();
    db.httpTriggerExecution.findMany.mockResolvedValue([]);
    db.httpTriggerExecution.count.mockResolvedValue(0);

    // Act
    await getHttpTriggerExecutionsPage("trigger-1", 2, 10, asDb(db));

    // Assert
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
  });
});

describe("getHttpTriggerExecutionSummary", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("loads the pipeline through the trigger in the same query", async () => {
    // Setup
    const db = createMockDb();
    db.httpTriggerExecution.findFirst.mockResolvedValue(summaryRow());

    // Act
    await getHttpTriggerExecutionSummary("trigger-1", "exec-1", asDb(db));

    // Assert
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
    // Setup
    const db = createMockDb();
    db.httpTriggerExecution.findFirst.mockResolvedValue(summaryRow());

    // Act
    const summary = await getHttpTriggerExecutionSummary(
      "trigger-1",
      "exec-1",
      asDb(db),
    );

    // Assert
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
    // Setup
    const db = createMockDb();
    db.httpTriggerExecution.findFirst.mockResolvedValue(null);

    // Act
    const summary = await getHttpTriggerExecutionSummary(
      "other-trigger",
      "exec-1",
      asDb(db),
    );

    // Assert
    expect(summary).toBeNull();
  });
});
