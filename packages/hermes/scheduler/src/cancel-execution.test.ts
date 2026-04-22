/** @vitest-environment node */
import {
  AgentJobExecutionStatus,
  ScheduleRunStatus,
} from "@hermes/orchestration-database";
import { describe, expect, it, vi } from "vitest";
import {
  cancelTaggedHermesQueueJobs,
  errorIndicatesUserCancel,
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
