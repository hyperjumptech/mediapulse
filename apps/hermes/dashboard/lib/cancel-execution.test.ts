/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  AgentJobExecutionStatus,
  ScheduleRunStatus,
  ScheduleStepRollupStatus,
} from "@hermes/orchestration-database";

import { cancelExecution } from "./cancel-execution";

const fixedNow = new Date("2026-03-26T14:30:00.000Z");

const createDbMock = () => {
  const tx = {
    scheduleExecution: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    scheduleStepExecution: {
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    httpTriggerExecution: {
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    httpTriggerStepExecution: {
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    manualPipelineExecution: {
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    manualPipelineStepExecution: {
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    agentJobExecution: { updateMany: vi.fn().mockResolvedValue({ count: 2 }) },
  };

  const db = {
    scheduleExecution: {
      findUnique: vi.fn(),
    },
    httpTriggerExecution: {
      findUnique: vi.fn(),
    },
    manualPipelineExecution: {
      findUnique: vi.fn(),
    },
    $transaction: vi.fn(async (callback: (input: typeof tx) => Promise<void>) =>
      callback(tx),
    ),
  };

  return { db, tx };
};

describe("cancelExecution", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns not_found when schedule execution does not exist", async () => {
    // Setup
    const { db } = createDbMock();
    db.scheduleExecution.findUnique.mockResolvedValue(null);
    const queue = { cancelAllUpcomingJobs: vi.fn().mockResolvedValue(0) };

    // Act
    const result = await cancelExecution("schedule", "missing", {
      db: db as never,
      queue,
      now: () => fixedNow,
    });

    // Assert
    expect(result).toEqual({ kind: "not_found" });
    expect(queue.cancelAllUpcomingJobs).not.toHaveBeenCalled();
  });

  it("returns already_terminal when run status is terminal", async () => {
    // Setup
    const { db } = createDbMock();
    db.scheduleExecution.findUnique.mockResolvedValue({
      runStatus: ScheduleRunStatus.succeeded,
    });
    const queue = { cancelAllUpcomingJobs: vi.fn().mockResolvedValue(0) };

    // Act
    const result = await cancelExecution("schedule", "exec-1", {
      db: db as never,
      queue,
      now: () => fixedNow,
    });

    // Assert
    expect(result).toEqual({
      kind: "already_terminal",
      runStatus: ScheduleRunStatus.succeeded,
    });
    expect(queue.cancelAllUpcomingJobs).not.toHaveBeenCalled();
  });

  it("cancels schedule execution and queue jobs", async () => {
    // Setup
    const { db, tx } = createDbMock();
    db.scheduleExecution.findUnique.mockResolvedValue({
      runStatus: ScheduleRunStatus.running,
    });
    const queue = { cancelAllUpcomingJobs: vi.fn().mockResolvedValue(3) };

    // Act
    const result = await cancelExecution("schedule", "exec-1", {
      db: db as never,
      queue,
      now: () => fixedNow,
    });

    // Assert
    expect(result).toEqual({
      kind: "cancelled",
      runStatus: ScheduleRunStatus.cancelled,
    });
    expect(queue.cancelAllUpcomingJobs).toHaveBeenCalledWith({
      tags: { values: ["scheduleExecution:exec-1"], mode: "all" },
    });
    expect(tx.scheduleExecution.updateMany).toHaveBeenCalledWith({
      where: {
        id: "exec-1",
        runStatus: {
          in: [ScheduleRunStatus.pending, ScheduleRunStatus.running],
        },
      },
      data: { runStatus: ScheduleRunStatus.cancelled },
    });
    expect(tx.scheduleStepExecution.updateMany).toHaveBeenCalledWith({
      where: {
        scheduleExecutionId: "exec-1",
        rollupStatus: {
          in: [
            ScheduleStepRollupStatus.pending,
            ScheduleStepRollupStatus.running,
          ],
        },
      },
      data: { rollupStatus: ScheduleStepRollupStatus.cancelled },
    });
    expect(tx.agentJobExecution.updateMany).toHaveBeenCalledWith({
      where: {
        scheduleExecutionId: "exec-1",
        status: {
          in: [
            AgentJobExecutionStatus.pending,
            AgentJobExecutionStatus.running,
          ],
        },
      },
      data: {
        status: AgentJobExecutionStatus.cancelled,
        completedAt: fixedNow,
        error: {
          message: "Execution cancelled by dashboard user",
          cancelled: true,
        },
      },
    });
  });

  it("cancels manual execution and queue jobs", async () => {
    // Setup
    const { db, tx } = createDbMock();
    db.manualPipelineExecution.findUnique.mockResolvedValue({
      runStatus: ScheduleRunStatus.pending,
    });
    const queue = { cancelAllUpcomingJobs: vi.fn().mockResolvedValue(2) };

    // Act
    const result = await cancelExecution("manual", "manual-exec-1", {
      db: db as never,
      queue,
      now: () => fixedNow,
    });

    // Assert
    expect(result).toEqual({
      kind: "cancelled",
      runStatus: ScheduleRunStatus.cancelled,
    });
    expect(queue.cancelAllUpcomingJobs).toHaveBeenCalledWith({
      tags: { values: ["manualExecution:manual-exec-1"], mode: "all" },
    });
    expect(tx.manualPipelineExecution.updateMany).toHaveBeenCalled();
    expect(tx.manualPipelineStepExecution.updateMany).toHaveBeenCalled();
    expect(tx.agentJobExecution.updateMany).toHaveBeenCalled();
  });
});
