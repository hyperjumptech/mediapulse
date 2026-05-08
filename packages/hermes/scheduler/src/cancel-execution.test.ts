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
  ScheduleStepRollupStatus: {
    pending: "pending",
    running: "running",
    success: "success",
    failed: "failed",
    partial: "partial",
    cancelled: "cancelled",
    skipped: "skipped",
  },
}));

import {
  AgentJobExecutionStatus,
  ScheduleRunStatus,
} from "@hermes/orchestration-database";
import { describe, expect, it, vi } from "vitest";
import {
  cancelTaggedHermesQueueJobs,
  errorIndicatesUserCancel,
  loadManualPipelineFinalizeSnapshotFromDb,
  resolveRunStatusForSettledCancelledExecution,
} from "./cancel-execution";

describe("cancel-execution", () => {
  it("resolveRunStatusForSettledCancelledExecution returns cancelled when all jobs are cancelled", () => {
    const jobs = [
      { status: AgentJobExecutionStatus.cancelled, error: null },
      { status: AgentJobExecutionStatus.cancelled, error: null },
    ];
    expect(resolveRunStatusForSettledCancelledExecution(jobs)).toBe(
      ScheduleRunStatus.cancelled,
    );
  });

  it("resolveRunStatusForSettledCancelledExecution returns partial when some completed and some cancelled", () => {
    const jobs = [
      { status: AgentJobExecutionStatus.completed, error: null },
      { status: AgentJobExecutionStatus.cancelled, error: null },
    ];
    expect(resolveRunStatusForSettledCancelledExecution(jobs)).toBe(
      ScheduleRunStatus.partial,
    );
  });

  it("resolveRunStatusForSettledCancelledExecution returns failed when an agent failure exists", () => {
    const jobs = [
      { status: AgentJobExecutionStatus.failed, error: { message: "boom" } },
      { status: AgentJobExecutionStatus.cancelled, error: null },
    ];
    expect(resolveRunStatusForSettledCancelledExecution(jobs)).toBe(
      ScheduleRunStatus.failed,
    );
  });

  it("errorIndicatesUserCancel detects structured cancel errors", () => {
    expect(errorIndicatesUserCancel({ cancelled: true })).toBe(true);
    expect(errorIndicatesUserCancel({ message: "x" })).toBe(false);
  });
});

describe("loadManualPipelineFinalizeSnapshotFromDb", () => {
  it("builds plannedJobs and processedJobIds from agent rows", async () => {
    const manualExecutionId = "00000000-0000-4000-8000-000000000030";
    const db = {
      agentJobExecution: {
        findMany: vi.fn().mockResolvedValue([
          {
            jobId: "job-a",
            pipelineStepId: "step-1",
            status: AgentJobExecutionStatus.running,
          },
          {
            jobId: "job-b",
            pipelineStepId: "step-1",
            status: AgentJobExecutionStatus.completed,
          },
        ]),
      },
    };
    const result = await loadManualPipelineFinalizeSnapshotFromDb(
      db as never,
      manualExecutionId,
    );
    expect(db.agentJobExecution.findMany).toHaveBeenCalledWith({
      where: { manualExecutionId },
      select: { jobId: true, pipelineStepId: true, status: true },
    });
    expect(result.plannedJobs).toEqual([
      { jobId: "job-a", pipelineStepId: "step-1" },
      { jobId: "job-b", pipelineStepId: "step-1" },
    ]);
    expect(result.processedJobIds.has("job-b")).toBe(true);
    expect(result.processedJobIds.has("job-a")).toBe(false);
  });
});

describe("cancelTaggedHermesQueueJobs", () => {
  it("calls cancelAllUpcomingJobs then cancelJob for pending and waiting matches", async () => {
    const cancelAllUpcomingJobs = vi.fn().mockResolvedValue(undefined);
    const getJobsByTags = vi
      .fn()
      .mockResolvedValueOnce([
        { id: 10, status: "waiting" },
        { id: 11, status: "cancelled" },
        { id: 12, status: "pending" },
      ])
      .mockResolvedValueOnce([]);
    const cancelJob = vi.fn().mockResolvedValue(undefined);

    await cancelTaggedHermesQueueJobs(
      { cancelAllUpcomingJobs, getJobsByTags, cancelJob },
      "scheduleExecution:00000000-0000-4000-8000-000000000099",
    );

    expect(cancelAllUpcomingJobs).toHaveBeenCalledWith({
      tags: {
        values: ["scheduleExecution:00000000-0000-4000-8000-000000000099"],
        mode: "all",
      },
    });
    expect(cancelJob).toHaveBeenCalledWith(10);
    expect(cancelJob).toHaveBeenCalledWith(12);
    expect(cancelJob).not.toHaveBeenCalledWith(11);
  });

  it("skips getJobsByTags when optional methods are absent", async () => {
    const cancelAllUpcomingJobs = vi.fn().mockResolvedValue(undefined);
    await cancelTaggedHermesQueueJobs(
      { cancelAllUpcomingJobs },
      "scheduleExecution:x",
    );
    expect(cancelAllUpcomingJobs).toHaveBeenCalledTimes(1);
  });
});
