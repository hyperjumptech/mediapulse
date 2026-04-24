/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";

const findFirstMock = vi.fn();

vi.mock("@hermes/orchestration-database", () => ({
  prisma: {
    manualPipelineExecution: {
      findFirst: (...args: unknown[]) => findFirstMock(...args),
    },
  },
}));

import { getManualPipelineExecutionDetail } from "./pipeline-executions";

describe("getManualPipelineExecutionDetail", () => {
  afterEach(() => {
    findFirstMock.mockReset();
  });

  it("derives invocation counts and step rollups from agent_job_execution rows", async () => {
    const stepId = "step-1";
    findFirstMock.mockResolvedValue({
      id: "exec-1",
      executionTime: new Date("2026-04-21T12:00:00.000Z"),
      enqueueStatus: "success",
      runStatus: "running",
      effectiveExecutionConfig: {
        schemaVersion: 1,
        stepRollupPolicy: "strict",
        stepOrder: "sequential",
        continueSequentialAfterPartial: false,
      },
      jobsCreated: 2,
      jobsEnqueued: 2,
      succeededInvocationCount: 0,
      failedInvocationCount: 0,
      errors: null,
      metadata: { source: "dashboard" },
      createdAt: new Date("2026-04-21T12:00:00.000Z"),
      pipeline: { id: "pipe-1", name: "P" },
      manualPipelineStepExecutions: [
        {
          pipelineStepId: stepId,
          expectedInvocationCount: 2,
          succeededCount: 0,
          failedCount: 0,
          rollupStatus: "running",
          pipelineStep: {
            id: stepId,
            order: 0,
            agentId: "article-analysis",
            agentVersion: "1.0.0",
          },
        },
      ],
      agentJobExecutions: [
        {
          jobId: "j1",
          status: "failed",
          agentId: "article-analysis",
          pipelineStepId: stepId,
          params: {},
          invocationConfig: null,
          error: { code: 502 },
          agentResponse: null,
          semanticStatus: "failure",
          enqueuedAt: new Date("2026-04-21T12:00:00.000Z"),
          startedAt: new Date("2026-04-21T12:00:01.000Z"),
          completedAt: new Date("2026-04-21T12:00:02.000Z"),
          dataQueueAttempts: null,
          dataQueueMaxAttempts: null,
        },
        {
          jobId: "j2",
          status: "running",
          agentId: "article-analysis",
          pipelineStepId: stepId,
          params: {},
          invocationConfig: null,
          error: null,
          agentResponse: null,
          semanticStatus: null,
          enqueuedAt: new Date("2026-04-21T12:00:00.000Z"),
          startedAt: new Date("2026-04-21T12:00:03.000Z"),
          completedAt: null,
          dataQueueAttempts: null,
          dataQueueMaxAttempts: null,
        },
      ],
    });

    const detail = await getManualPipelineExecutionDetail("pipe-1", "exec-1");

    expect(detail).not.toBeNull();
    expect(detail!.execution.succeededInvocationCount).toBe(0);
    expect(detail!.execution.failedInvocationCount).toBe(1);
    const step = detail!.stepExecutions[0];
    expect(step?.succeededCount).toBe(0);
    expect(step?.failedCount).toBe(1);
    expect(step?.rollupStatus).toBe("running");
  });

  it("computes terminal step rollup when all jobs finished", async () => {
    const stepId = "step-1";
    findFirstMock.mockResolvedValue({
      id: "exec-2",
      executionTime: new Date("2026-04-21T12:00:00.000Z"),
      enqueueStatus: "success",
      runStatus: "succeeded",
      effectiveExecutionConfig: {
        schemaVersion: 1,
        stepRollupPolicy: "strict",
        stepOrder: "sequential",
        continueSequentialAfterPartial: false,
      },
      jobsCreated: 2,
      jobsEnqueued: 2,
      succeededInvocationCount: 2,
      failedInvocationCount: 0,
      errors: null,
      metadata: null,
      createdAt: new Date("2026-04-21T12:00:00.000Z"),
      pipeline: { id: "pipe-1", name: "P" },
      manualPipelineStepExecutions: [
        {
          pipelineStepId: stepId,
          expectedInvocationCount: 2,
          succeededCount: 2,
          failedCount: 0,
          rollupStatus: "success",
          pipelineStep: {
            id: stepId,
            order: 0,
            agentId: "a",
            agentVersion: "1.0.0",
          },
        },
      ],
      agentJobExecutions: [
        {
          jobId: "j1",
          status: "completed",
          agentId: "a",
          pipelineStepId: stepId,
          params: {},
          invocationConfig: null,
          error: null,
          agentResponse: {},
          semanticStatus: "success",
          enqueuedAt: new Date("2026-04-21T12:00:00.000Z"),
          startedAt: new Date("2026-04-21T12:00:01.000Z"),
          completedAt: new Date("2026-04-21T12:00:02.000Z"),
          dataQueueAttempts: null,
          dataQueueMaxAttempts: null,
        },
        {
          jobId: "j2",
          status: "completed",
          agentId: "a",
          pipelineStepId: stepId,
          params: {},
          invocationConfig: null,
          error: null,
          agentResponse: {},
          semanticStatus: "success",
          enqueuedAt: new Date("2026-04-21T12:00:00.000Z"),
          startedAt: new Date("2026-04-21T12:00:01.000Z"),
          completedAt: new Date("2026-04-21T12:00:02.000Z"),
          dataQueueAttempts: null,
          dataQueueMaxAttempts: null,
        },
      ],
    });

    const detail = await getManualPipelineExecutionDetail("pipe-1", "exec-2");
    expect(detail!.execution.succeededInvocationCount).toBe(2);
    expect(detail!.execution.failedInvocationCount).toBe(0);
    expect(detail!.stepExecutions[0]?.rollupStatus).toBe("success");
  });
});
