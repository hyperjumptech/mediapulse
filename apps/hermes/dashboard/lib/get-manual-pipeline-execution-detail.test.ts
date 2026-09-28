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

import {
  getManualPipelineExecutionDetail,
  getManualPipelineExecutionSummary,
} from "./pipeline-executions";

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

describe("getManualPipelineExecutionSummary", () => {
  afterEach(() => {
    findFirstMock.mockReset();
  });

  const stepId = "step-1";

  const summaryRow = () => ({
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
        semanticStatus: "failure",
        agentId: "article-analysis",
        pipelineStepId: stepId,
        error: { message: "Bad gateway" },
        agentResponse: null,
        enqueuedAt: new Date("2026-04-21T12:00:00.000Z"),
        startedAt: new Date("2026-04-21T12:00:01.000Z"),
        completedAt: new Date("2026-04-21T12:00:02.000Z"),
        dataQueueAttempts: null,
        dataQueueMaxAttempts: null,
      },
      {
        jobId: "j2",
        status: "running",
        semanticStatus: null,
        agentId: "article-analysis",
        pipelineStepId: stepId,
        error: null,
        agentResponse: null,
        enqueuedAt: new Date("2026-04-21T12:00:00.000Z"),
        startedAt: new Date("2026-04-21T12:00:03.000Z"),
        completedAt: null,
        dataQueueAttempts: 1,
        dataQueueMaxAttempts: 3,
      },
    ],
  });

  it("selects job scalars plus the outcome inputs, never params or config", async () => {
    // Setup
    findFirstMock.mockResolvedValue(summaryRow());

    // Act
    await getManualPipelineExecutionSummary("pipe-1", "exec-1");

    // Assert
    expect(findFirstMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "exec-1", pipelineId: "pipe-1" },
        select: expect.objectContaining({
          pipeline: { select: { id: true, name: true } },
          agentJobExecutions: {
            orderBy: { enqueuedAt: "asc" },
            select: {
              jobId: true,
              status: true,
              semanticStatus: true,
              agentId: true,
              error: true,
              agentResponse: true,
              enqueuedAt: true,
              startedAt: true,
              completedAt: true,
              dataQueueAttempts: true,
              dataQueueMaxAttempts: true,
              pipelineStepId: true,
            },
          },
        }),
      }),
    );
  });

  it("derives invocation counts and step rollups from job rows", async () => {
    // Setup
    findFirstMock.mockResolvedValue(summaryRow());

    // Act
    const summary = await getManualPipelineExecutionSummary("pipe-1", "exec-1");

    // Assert
    expect(summary?.execution.succeededInvocationCount).toBe(0);
    expect(summary?.execution.failedInvocationCount).toBe(1);
    expect(summary?.stepExecutions[0]).toMatchObject({
      pipelineStepId: stepId,
      stepOrder: 0,
      succeededCount: 0,
      failedCount: 1,
      rollupStatus: "running",
    });
  });

  it("returns invocation rows with the outcome summary instead of raw JSON", async () => {
    // Setup
    findFirstMock.mockResolvedValue(summaryRow());

    // Act
    const summary = await getManualPipelineExecutionSummary("pipe-1", "exec-1");

    // Assert
    expect(summary?.invocations[0]).toEqual({
      jobId: "j1",
      status: "failed",
      semanticStatus: "failure",
      agentId: "article-analysis",
      outcomeSummary: "Bad gateway",
      enqueuedAt: new Date("2026-04-21T12:00:00.000Z"),
      startedAt: new Date("2026-04-21T12:00:01.000Z"),
      completedAt: new Date("2026-04-21T12:00:02.000Z"),
      dataQueueAttempts: null,
      dataQueueMaxAttempts: null,
    });
  });

  it("returns null when the execution does not belong to the pipeline", async () => {
    // Setup
    findFirstMock.mockResolvedValue(null);

    // Act
    const summary = await getManualPipelineExecutionSummary(
      "other-pipeline",
      "exec-1",
    );

    // Assert
    expect(summary).toBeNull();
  });
});
