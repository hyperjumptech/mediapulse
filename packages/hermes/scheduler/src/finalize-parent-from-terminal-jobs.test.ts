/** @vitest-environment node */
import { describe, expect, it, vi } from "vitest";

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

import {
  areAllAgentJobsTerminal,
  countInvocationOutcomesFromTerminalJobs,
  resolveParentRunStatusWhenStepRowsMissing,
  resolveRunStatusFromTerminalJobs,
} from "./finalize-parent-from-terminal-jobs";

describe("finalize-parent-from-terminal-jobs", () => {
  it("areAllAgentJobsTerminal returns false for empty or non-terminal jobs", () => {
    // Assert
    expect(areAllAgentJobsTerminal([])).toBe(false);
    expect(
      areAllAgentJobsTerminal([
        { status: AgentJobExecutionStatus.completed },
        { status: AgentJobExecutionStatus.pending },
      ]),
    ).toBe(false);
  });

  it("areAllAgentJobsTerminal returns true when every job is terminal", () => {
    // Act
    const result = areAllAgentJobsTerminal([
      { status: AgentJobExecutionStatus.failed },
      { status: AgentJobExecutionStatus.completed },
    ]);

    // Assert
    expect(result).toBe(true);
  });

  it("resolveRunStatusFromTerminalJobs maps failed jobs to failed parent status", () => {
    // Act
    const result = resolveRunStatusFromTerminalJobs([
      {
        status: AgentJobExecutionStatus.failed,
        error: { message: "boom" },
      },
    ]);

    // Assert
    expect(result).toBe(ScheduleRunStatus.failed);
  });

  it("countInvocationOutcomesFromTerminalJobs counts successes and non-successes", () => {
    // Act
    const result = countInvocationOutcomesFromTerminalJobs([
      { status: AgentJobExecutionStatus.completed, error: null },
      { status: AgentJobExecutionStatus.failed, error: { message: "x" } },
      { status: AgentJobExecutionStatus.cancelled, error: null },
    ]);

    // Assert
    expect(result).toEqual({
      succeededInvocationCount: 1,
      failedInvocationCount: 2,
    });
  });

  it("resolveParentRunStatusWhenStepRowsMissing returns null until all jobs are terminal", () => {
    // Assert
    expect(
      resolveParentRunStatusWhenStepRowsMissing([
        { status: AgentJobExecutionStatus.running, error: null },
      ]),
    ).toBeNull();
    expect(
      resolveParentRunStatusWhenStepRowsMissing([
        { status: AgentJobExecutionStatus.failed, error: { message: "x" } },
      ]),
    ).toBe(ScheduleRunStatus.failed);
  });
});
