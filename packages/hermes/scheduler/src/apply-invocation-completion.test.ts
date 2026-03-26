/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  AgentJobExecutionStatus,
  ScheduleRunStatus,
  ScheduleStepRollupStatus,
} from "@hermes/orchestration-database";

import { applyInvocationCompletion } from "./apply-invocation-completion";

const logger = {
  warn: vi.fn(),
  error: vi.fn(),
};

describe("applyInvocationCompletion", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("does not overwrite already-cancelled execution state", async () => {
    // Setup
    const db = {
      scheduleExecution: {
        findUnique: vi.fn().mockResolvedValue({
          id: "exec-1",
          runStatus: ScheduleRunStatus.cancelled,
        }),
      },
      httpTriggerExecution: { findUnique: vi.fn() },
      manualPipelineExecution: { findUnique: vi.fn() },
      $transaction: vi.fn(),
    };

    // Act
    await applyInvocationCompletion(
      {
        jobId: "job-1",
        scheduleExecutionId: "exec-1",
        pipelineStepId: "step-1",
        terminal: {
          status: AgentJobExecutionStatus.completed,
          envelope: {
            status: "success",
            message: "ok",
            details: {},
            logs: [],
            schemaVersion: 1,
            truncated: {},
          },
        },
      },
      { db: db as never, logger },
    );

    // Assert
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("updates manual execution rollups on successful completion", async () => {
    // Setup
    const manualPipelineStepExecutionUpdate = vi
      .fn()
      .mockResolvedValueOnce({
        id: "step-exec-1",
        succeededCount: 1,
        failedCount: 0,
        expectedInvocationCount: 1,
        rollupStatus: ScheduleStepRollupStatus.running,
      })
      .mockResolvedValueOnce({
        id: "step-exec-1",
        succeededCount: 1,
        failedCount: 0,
        expectedInvocationCount: 1,
        rollupStatus: ScheduleStepRollupStatus.success,
      });
    const tx = {
      agentJobExecution: {
        update: vi.fn().mockResolvedValue(undefined),
      },
      manualPipelineExecution: {
        update: vi.fn().mockResolvedValue(undefined),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      manualPipelineStepExecution: {
        findUnique: vi.fn().mockResolvedValue({
          id: "step-exec-1",
          succeededCount: 0,
          failedCount: 0,
          expectedInvocationCount: 1,
          rollupStatus: ScheduleStepRollupStatus.pending,
        }),
        update: manualPipelineStepExecutionUpdate,
        findMany: vi
          .fn()
          .mockResolvedValue([
            { rollupStatus: ScheduleStepRollupStatus.success },
          ]),
      },
      scheduleExecution: {
        update: vi.fn(),
        updateMany: vi.fn(),
      },
      httpTriggerExecution: {
        update: vi.fn(),
        updateMany: vi.fn(),
      },
      scheduleStepExecution: {
        findUnique: vi.fn(),
        update: vi.fn(),
        findMany: vi.fn(),
      },
      httpTriggerStepExecution: {
        findUnique: vi.fn(),
        update: vi.fn(),
        findMany: vi.fn(),
      },
    };
    const db = {
      scheduleExecution: { findUnique: vi.fn() },
      httpTriggerExecution: { findUnique: vi.fn() },
      manualPipelineExecution: {
        findUnique: vi.fn().mockResolvedValue({
          id: "manual-exec-1",
          runStatus: ScheduleRunStatus.pending,
          effectiveExecutionConfig: null,
        }),
      },
      $transaction: vi.fn(
        async (callback: (value: typeof tx) => Promise<void>) => callback(tx),
      ),
    };

    // Act
    await applyInvocationCompletion(
      {
        jobId: "job-1",
        manualExecutionId: "manual-exec-1",
        pipelineStepId: "step-1",
        terminal: {
          status: AgentJobExecutionStatus.completed,
          envelope: {
            status: "success",
            message: "ok",
            details: {},
            logs: [],
            schemaVersion: 1,
            truncated: {},
          },
        },
      },
      { db: db as never, logger },
    );

    // Assert
    expect(tx.manualPipelineExecution.update).toHaveBeenCalledWith({
      where: { id: "manual-exec-1" },
      data: {
        runStatus: ScheduleRunStatus.running,
        succeededInvocationCount: { increment: 1 },
      },
    });
    expect(tx.manualPipelineExecution.updateMany).toHaveBeenCalledWith({
      where: {
        id: "manual-exec-1",
        runStatus: {
          in: [ScheduleRunStatus.pending, ScheduleRunStatus.running],
        },
      },
      data: { runStatus: ScheduleRunStatus.succeeded },
    });
  });
});
