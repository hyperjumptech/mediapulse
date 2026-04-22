/** @vitest-environment node */
import {
  AgentJobExecutionStatus,
  ScheduleRunStatus,
} from "@hermes/orchestration-database";
import { describe, expect, it } from "vitest";
import {
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
