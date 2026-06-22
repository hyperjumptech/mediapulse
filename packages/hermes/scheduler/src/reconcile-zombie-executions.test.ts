/** @vitest-environment node */
vi.mock("@hermes/orchestration-database", () => ({
  AgentJobExecutionStatus: {
    pending: "pending",
    running: "running",
    completed: "completed",
    failed: "failed",
    cancelled: "cancelled",
  },
  ScheduleRunStatus: {
    pending: "pending",
    running: "running",
    succeeded: "succeeded",
    failed: "failed",
    partial: "partial",
    cancelled: "cancelled",
  },
}));

import {
  AgentJobExecutionStatus,
  ScheduleRunStatus,
} from "@hermes/orchestration-database";
import { afterEach, describe, expect, it, vi } from "vitest";

import { reconcileZombieExecutions } from "./reconcile-zombie-executions";

describe("reconcileZombieExecutions", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("finalizes schedule executions whose agent jobs are already terminal", async () => {
    // Setup
    const scheduleExecutionId = "00000000-0000-4000-8000-000000000010";
    const logger = { info: vi.fn(), warn: vi.fn() };
    const db = {
      scheduleExecution: {
        findMany: vi
          .fn()
          .mockResolvedValue([{ id: scheduleExecutionId, cancelledAt: null }]),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      httpTriggerExecution: {
        findMany: vi.fn().mockResolvedValue([]),
        updateMany: vi.fn(),
      },
      manualPipelineExecution: {
        findMany: vi.fn().mockResolvedValue([]),
        updateMany: vi.fn(),
      },
      agentJobExecution: {
        findMany: vi.fn().mockResolvedValue([
          {
            status: AgentJobExecutionStatus.failed,
            error: { message: "orphan" },
          },
        ]),
      },
    };

    // Act
    const finalized = await reconcileZombieExecutions({
      db: db as never,
      logger,
    });

    // Assert
    expect(finalized).toBe(1);
    expect(db.scheduleExecution.updateMany).toHaveBeenCalledWith({
      where: {
        id: scheduleExecutionId,
        runStatus: {
          in: [ScheduleRunStatus.pending, ScheduleRunStatus.running],
        },
      },
      data: {
        runStatus: ScheduleRunStatus.failed,
        succeededInvocationCount: 0,
        failedInvocationCount: 1,
      },
    });
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ scheduleExecutionId }),
      "reconcile_zombie_executions: finalized schedule execution from terminal jobs",
    );
  });

  it("skips parents that still have non-terminal agent jobs", async () => {
    // Setup
    const db = {
      scheduleExecution: {
        findMany: vi
          .fn()
          .mockResolvedValue([
            { id: "00000000-0000-4000-8000-000000000011", cancelledAt: null },
          ]),
        updateMany: vi.fn(),
      },
      httpTriggerExecution: {
        findMany: vi.fn().mockResolvedValue([]),
        updateMany: vi.fn(),
      },
      manualPipelineExecution: {
        findMany: vi.fn().mockResolvedValue([]),
        updateMany: vi.fn(),
      },
      agentJobExecution: {
        findMany: vi
          .fn()
          .mockResolvedValue([
            { status: AgentJobExecutionStatus.pending, error: null },
          ]),
      },
    };

    // Act
    const finalized = await reconcileZombieExecutions({
      db: db as never,
      logger: { info: vi.fn(), warn: vi.fn() },
    });

    // Assert
    expect(finalized).toBe(0);
    expect(db.scheduleExecution.updateMany).not.toHaveBeenCalled();
  });
});
