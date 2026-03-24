/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";

import { getPipelineExecutionsPage } from "./pipeline-executions";

const scheduleExecutionFindManyMock = vi.fn();
const httpTriggerExecutionFindManyMock = vi.fn();
const manualPipelineExecutionFindManyMock = vi.fn();

vi.mock("@hermes/orchestration-database", () => ({
  prisma: {
    scheduleExecution: {
      findMany: (...args: unknown[]) => scheduleExecutionFindManyMock(...args),
    },
    httpTriggerExecution: {
      findMany: (...args: unknown[]) =>
        httpTriggerExecutionFindManyMock(...args),
    },
    manualPipelineExecution: {
      findMany: (...args: unknown[]) =>
        manualPipelineExecutionFindManyMock(...args),
    },
  },
}));

describe("getPipelineExecutionsPage", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    scheduleExecutionFindManyMock.mockReset();
    httpTriggerExecutionFindManyMock.mockReset();
    manualPipelineExecutionFindManyMock.mockReset();
  });

  it("merges rows across sources and sorts by execution time desc", async () => {
    // Setup
    scheduleExecutionFindManyMock.mockResolvedValue([
      {
        id: "sch-exec-1",
        executionTime: new Date("2026-03-20T10:00:00.000Z"),
        enqueueStatus: "success",
        runStatus: "succeeded",
        jobsCreated: 3,
        jobsEnqueued: 3,
        succeededInvocationCount: 3,
        failedInvocationCount: 0,
        errors: null,
        createdAt: new Date("2026-03-20T10:00:00.000Z"),
        schedule: { id: "sch-1" },
      },
    ]);
    httpTriggerExecutionFindManyMock.mockResolvedValue([
      {
        id: "http-exec-1",
        executionTime: new Date("2026-03-20T11:00:00.000Z"),
        enqueueStatus: "success",
        runStatus: "partial",
        jobsCreated: 4,
        jobsEnqueued: 4,
        succeededInvocationCount: 3,
        failedInvocationCount: 1,
        errors: [{ message: "x" }],
        createdAt: new Date("2026-03-20T11:00:00.000Z"),
        httpTrigger: { id: "trigger-1" },
      },
    ]);
    manualPipelineExecutionFindManyMock.mockResolvedValue([
      {
        id: "manual-exec-1",
        pipelineId: "pipe-1",
        executionTime: new Date("2026-03-20T12:00:00.000Z"),
        enqueueStatus: "success",
        runStatus: "failed",
        jobsCreated: 2,
        jobsEnqueued: 2,
        succeededInvocationCount: 0,
        failedInvocationCount: 2,
        errors: [{ message: "y" }],
        createdAt: new Date("2026-03-20T12:00:00.000Z"),
      },
    ]);

    // Act
    const result = await getPipelineExecutionsPage("pipe-1", 1, 10);

    // Assert
    expect(result.total).toBe(3);
    expect(result.executions.map((item) => item.id)).toEqual([
      "manual-exec-1",
      "http-exec-1",
      "sch-exec-1",
    ]);
    expect(result.executions.map((item) => item.source)).toEqual([
      "manual",
      "http-trigger",
      "schedule",
    ]);
  });

  it("applies merged pagination after sorting", async () => {
    // Setup
    scheduleExecutionFindManyMock.mockResolvedValue([
      {
        id: "sch-exec-1",
        executionTime: new Date("2026-03-20T10:00:00.000Z"),
        enqueueStatus: "success",
        runStatus: "succeeded",
        jobsCreated: 1,
        jobsEnqueued: 1,
        succeededInvocationCount: 1,
        failedInvocationCount: 0,
        errors: null,
        createdAt: new Date("2026-03-20T10:00:00.000Z"),
        schedule: { id: "sch-1" },
      },
    ]);
    httpTriggerExecutionFindManyMock.mockResolvedValue([]);
    manualPipelineExecutionFindManyMock.mockResolvedValue([
      {
        id: "manual-exec-1",
        pipelineId: "pipe-1",
        executionTime: new Date("2026-03-20T12:00:00.000Z"),
        enqueueStatus: "success",
        runStatus: "succeeded",
        jobsCreated: 1,
        jobsEnqueued: 1,
        succeededInvocationCount: 1,
        failedInvocationCount: 0,
        errors: null,
        createdAt: new Date("2026-03-20T12:00:00.000Z"),
      },
      {
        id: "manual-exec-2",
        pipelineId: "pipe-1",
        executionTime: new Date("2026-03-20T11:00:00.000Z"),
        enqueueStatus: "success",
        runStatus: "succeeded",
        jobsCreated: 1,
        jobsEnqueued: 1,
        succeededInvocationCount: 1,
        failedInvocationCount: 0,
        errors: null,
        createdAt: new Date("2026-03-20T11:00:00.000Z"),
      },
    ]);

    // Act
    const result = await getPipelineExecutionsPage("pipe-1", 2, 2);

    // Assert
    expect(result.total).toBe(3);
    expect(result.executions).toHaveLength(1);
    expect(result.executions[0]?.id).toBe("sch-exec-1");
  });
});
