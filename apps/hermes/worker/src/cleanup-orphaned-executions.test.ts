/** @vitest-environment node */
import { AgentJobExecutionStatus } from "@hermes/orchestration-database";
import { applyInvocationCompletion } from "@hermes/scheduler";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanupOrphanedExecutions,
  DEFAULT_ORPHAN_THRESHOLD_MINUTES,
} from "./cleanup-orphaned-executions";

vi.mock("@hermes/orchestration-database", () => ({
  AgentJobExecutionStatus: {
    pending: "pending",
    running: "running",
    completed: "completed",
    failed: "failed",
    cancelled: "cancelled",
  },
}));

vi.mock("@hermes/scheduler", () => ({
  applyInvocationCompletion: vi.fn().mockResolvedValue(undefined),
}));

const mockFindMany = vi.fn();
const mockUpdate = vi.fn();

const makeDeps = (thresholdMinutes?: number) => ({
  db: {
    agentJobExecution: {
      findMany: mockFindMany,
      update: mockUpdate,
    },
  } as unknown as Parameters<typeof cleanupOrphanedExecutions>[0]["db"],
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
  },
  thresholdMinutes,
});

describe("cleanupOrphanedExecutions", () => {
  beforeEach(() => {
    mockFindMany.mockReset();
    mockUpdate.mockReset();
    vi.mocked(applyInvocationCompletion).mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 0 and does not call applyInvocationCompletion when no orphaned rows exist", async () => {
    // Setup
    mockFindMany.mockResolvedValue([]);
    const deps = makeDeps();

    // Act
    const result = await cleanupOrphanedExecutions(deps);

    // Assert
    expect(result).toBe(0);
    expect(applyInvocationCompletion).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("queries for running rows older than the threshold cutoff", async () => {
    // Setup
    const before = Date.now();
    mockFindMany.mockResolvedValue([]);
    const deps = makeDeps(30);

    // Act
    await cleanupOrphanedExecutions(deps);
    const after = Date.now();

    // Assert — cutoff should be approximately 30 minutes before call time
    const findManyCall = mockFindMany.mock.calls[0];
    expect(findManyCall).toBeDefined();
    const where = findManyCall![0].where as {
      status: string;
      completedAt: null;
      startedAt: { lt: Date };
    };
    expect(where.status).toBe(AgentJobExecutionStatus.running);
    expect(where.completedAt).toBeNull();
    const cutoff = where.startedAt.lt;
    expect(cutoff.getTime()).toBeGreaterThanOrEqual(
      before - 30 * 60 * 1_000 - 100,
    );
    expect(cutoff.getTime()).toBeLessThanOrEqual(after - 30 * 60 * 1_000 + 100);
  });

  it("uses DEFAULT_ORPHAN_THRESHOLD_MINUTES (60) when thresholdMinutes is omitted", async () => {
    // Setup
    const before = Date.now();
    mockFindMany.mockResolvedValue([]);
    const deps = makeDeps();

    // Act
    await cleanupOrphanedExecutions(deps);

    // Assert
    const where = mockFindMany.mock.calls[0]![0].where as {
      startedAt: { lt: Date };
    };
    const cutoff = where.startedAt.lt.getTime();
    expect(cutoff).toBeLessThanOrEqual(
      before - DEFAULT_ORPHAN_THRESHOLD_MINUTES * 60 * 1_000 + 100,
    );
  });

  it("calls applyInvocationCompletion with failed terminal for a row that has a schedule execution parent", async () => {
    // Setup
    const row = {
      id: "row-1",
      jobId: "job-1",
      scheduleExecutionId: "se-1",
      httpTriggerExecutionId: null,
      manualExecutionId: null,
      pipelineStepId: "step-1",
      startedAt: new Date(Date.now() - 90 * 60 * 1_000),
    };
    mockFindMany.mockResolvedValue([row]);
    const deps = makeDeps();

    // Act
    const result = await cleanupOrphanedExecutions(deps);

    // Assert
    expect(result).toBe(1);
    expect(applyInvocationCompletion).toHaveBeenCalledTimes(1);
    expect(applyInvocationCompletion).toHaveBeenCalledWith(
      {
        jobId: "job-1",
        scheduleExecutionId: "se-1",
        httpTriggerExecutionId: undefined,
        manualExecutionId: undefined,
        pipelineStepId: "step-1",
        terminal: {
          status: AgentJobExecutionStatus.failed,
          error: expect.objectContaining({
            message: expect.stringContaining("Orphaned"),
            retryable: false,
            orphanCleanup: true,
          }),
        },
      },
      expect.objectContaining({ db: expect.any(Object) }),
    );
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("calls applyInvocationCompletion with httpTriggerExecutionId for HTTP trigger rows", async () => {
    // Setup
    const row = {
      id: "row-2",
      jobId: "job-2",
      scheduleExecutionId: null,
      httpTriggerExecutionId: "ht-exec-1",
      manualExecutionId: null,
      pipelineStepId: "step-2",
      startedAt: new Date(Date.now() - 90 * 60 * 1_000),
    };
    mockFindMany.mockResolvedValue([row]);
    const deps = makeDeps();

    // Act
    const result = await cleanupOrphanedExecutions(deps);

    // Assert
    expect(result).toBe(1);
    expect(applyInvocationCompletion).toHaveBeenCalledWith(
      expect.objectContaining({
        jobId: "job-2",
        scheduleExecutionId: undefined,
        httpTriggerExecutionId: "ht-exec-1",
        manualExecutionId: undefined,
        pipelineStepId: "step-2",
      }),
      expect.any(Object),
    );
  });

  it("marks directly as failed (no applyInvocationCompletion) when no parent execution id is set", async () => {
    // Setup
    const row = {
      id: "row-3",
      jobId: "job-3",
      scheduleExecutionId: null,
      httpTriggerExecutionId: null,
      manualExecutionId: null,
      pipelineStepId: "step-3",
      startedAt: new Date(Date.now() - 90 * 60 * 1_000),
    };
    mockFindMany.mockResolvedValue([row]);
    mockUpdate.mockResolvedValue(undefined);
    const deps = makeDeps();

    // Act
    const result = await cleanupOrphanedExecutions(deps);

    // Assert
    expect(result).toBe(1);
    expect(applyInvocationCompletion).not.toHaveBeenCalled();
    expect(mockUpdate).toHaveBeenCalledTimes(1);
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { jobId: "job-3" },
      data: {
        status: AgentJobExecutionStatus.failed,
        completedAt: expect.any(Date),
        error: expect.objectContaining({
          message: expect.stringContaining("Orphaned"),
          retryable: false,
          orphanCleanup: true,
        }),
      },
    });
  });

  it("continues to next row and logs error when applyInvocationCompletion throws", async () => {
    // Setup
    const rowFail = {
      id: "row-bad",
      jobId: "job-bad",
      scheduleExecutionId: "se-fail",
      httpTriggerExecutionId: null,
      manualExecutionId: null,
      pipelineStepId: "step-fail",
      startedAt: new Date(Date.now() - 90 * 60 * 1_000),
    };
    const rowOk = {
      id: "row-ok",
      jobId: "job-ok",
      scheduleExecutionId: null,
      httpTriggerExecutionId: null,
      manualExecutionId: null,
      pipelineStepId: "step-ok",
      startedAt: new Date(Date.now() - 90 * 60 * 1_000),
    };
    mockFindMany.mockResolvedValue([rowFail, rowOk]);
    vi.mocked(applyInvocationCompletion).mockRejectedValueOnce(
      new Error("DB error"),
    );
    mockUpdate.mockResolvedValue(undefined);
    const deps = makeDeps();

    // Act
    const result = await cleanupOrphanedExecutions(deps);

    // Assert — failed row counted as not resolved; second row processed
    expect(result).toBe(1);
    expect(deps.logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ jobId: "job-bad" }),
      expect.stringContaining(
        "cleanup_orphaned_executions: failed to resolve row",
      ),
    );
    expect(mockUpdate).toHaveBeenCalledTimes(1);
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { jobId: "job-ok" } }),
    );
  });

  it("logs a warning when orphaned rows are found", async () => {
    // Setup
    const row = {
      id: "row-x",
      jobId: "job-x",
      scheduleExecutionId: null,
      httpTriggerExecutionId: null,
      manualExecutionId: null,
      pipelineStepId: null,
      startedAt: new Date(Date.now() - 90 * 60 * 1_000),
    };
    mockFindMany.mockResolvedValue([row]);
    mockUpdate.mockResolvedValue(undefined);
    const deps = makeDeps();

    // Act
    await cleanupOrphanedExecutions(deps);

    // Assert
    expect(deps.logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ count: 1, thresholdMinutes: 60 }),
      "cleanup_orphaned_executions: found stuck running rows",
    );
  });
});
