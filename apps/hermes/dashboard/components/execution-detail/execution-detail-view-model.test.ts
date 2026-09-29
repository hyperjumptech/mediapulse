import { describe, expect, it } from "vitest";

import { SECRET_MASK } from "@/lib/mask-json-secrets";

import {
  buildExecutionDetailViewModel,
  type ExecutionDetailSummary,
} from "./execution-detail-view-model";

const baseSummary = (): ExecutionDetailSummary => ({
  execution: {
    id: "exec-1",
    executionTime: new Date("2026-09-28T10:00:00.000Z"),
    enqueueStatus: "success",
    runStatus: "succeeded",
    effectiveExecutionConfig: null,
    jobsCreated: 2,
    jobsEnqueued: 2,
    succeededInvocationCount: 1,
    failedInvocationCount: 1,
    errors: [],
    metadata: null,
    createdAt: new Date("2026-09-28T10:00:00.000Z"),
  },
  pipeline: { id: "pipe-1", name: "Daily digest" },
  stepExecutions: [
    {
      pipelineStepId: "step-1",
      stepOrder: 1,
      agentId: "summarizer",
      agentVersion: "1.2.0",
      sourcePipelineName: null,
      expectedInvocationCount: 2,
      succeededCount: 1,
      failedCount: 1,
      rollupStatus: "partial",
    },
  ],
  invocations: [
    {
      jobId: "job-1",
      status: "completed",
      semanticStatus: "success",
      agentId: "summarizer",
      outcomeSummary: null,
      enqueuedAt: new Date("2026-09-28T10:00:00.000Z"),
      startedAt: new Date("2026-09-28T10:00:01.000Z"),
      completedAt: new Date("2026-09-28T10:00:04.000Z"),
      dataQueueAttempts: 1,
      dataQueueMaxAttempts: 3,
    },
    {
      jobId: "job-2",
      status: "failed",
      semanticStatus: null,
      agentId: "summarizer",
      outcomeSummary: "HTTP 502",
      enqueuedAt: new Date("2026-09-28T10:00:00.000Z"),
      startedAt: null,
      completedAt: null,
      dataQueueAttempts: null,
      dataQueueMaxAttempts: null,
    },
  ],
});

describe("buildExecutionDetailViewModel", () => {
  it("builds a schedule execution with its processed URLs link", () => {
    const summary = baseSummary();

    const viewModel = buildExecutionDetailViewModel({
      parent: { kind: "schedule", id: "sched-1", name: "Morning run" },
      executionId: "exec-1",
      summary,
    });

    expect(viewModel).toMatchObject({
      executionId: "exec-1",
      parent: { kind: "schedule", id: "sched-1", name: "Morning run" },
      sourceLabel: null,
      pipeline: { id: "pipe-1", name: "Daily digest" },
      runStatus: "succeeded",
      enqueueStatus: "success",
      executionTimeIso: "2026-09-28T10:00:00.000Z",
      elapsedLabel: "4s",
      succeededInvocationCount: 1,
      failedInvocationCount: 1,
      expectedInvocationCount: 2,
      metadataHints: [],
      requestSnapshotJson: null,
      runParamsJson: null,
      canCancel: false,
      cancelTarget: {
        kind: "schedule",
        scheduleId: "sched-1",
        scheduleExecutionId: "exec-1",
      },
      payloadSource: {
        kind: "schedule",
        parentId: "sched-1",
        executionId: "exec-1",
      },
      processedUrlsHref:
        "/dashboard/schedules/sched-1/executions/exec-1/processed-urls",
    });
    expect(viewModel.steps).toEqual(summary.stepExecutions);
  });

  it("maps invocations to scalar rows with ISO timestamps", () => {
    const viewModel = buildExecutionDetailViewModel({
      parent: { kind: "schedule", id: "sched-1", name: "Morning run" },
      executionId: "exec-1",
      summary: baseSummary(),
    });

    expect(viewModel.invocations).toEqual([
      {
        jobId: "job-1",
        status: "completed",
        semanticStatus: "success",
        outcomeSummary: null,
        agentId: "summarizer",
        startedAtIso: "2026-09-28T10:00:01.000Z",
        completedAtIso: "2026-09-28T10:00:04.000Z",
        dataQueueAttempts: 1,
        dataQueueMaxAttempts: 3,
      },
      {
        jobId: "job-2",
        status: "failed",
        semanticStatus: null,
        outcomeSummary: "HTTP 502",
        agentId: "summarizer",
        startedAtIso: null,
        completedAtIso: null,
        dataQueueAttempts: null,
        dataQueueMaxAttempts: null,
      },
    ]);
  });

  it("exposes the masked request snapshot for HTTP trigger executions", () => {
    const summary = baseSummary();
    summary.execution.runStatus = "running";
    summary.execution.metadata = {
      method: "POST",
      headers: { authorization: "Bearer secret-token" },
    };

    const viewModel = buildExecutionDetailViewModel({
      parent: { kind: "httpTrigger", id: "trig-1", name: "Webhook" },
      executionId: "exec-1",
      summary,
    });

    expect(viewModel.sourceLabel).toBeNull();
    expect(viewModel.canCancel).toBe(true);
    expect(viewModel.cancelTarget).toEqual({
      kind: "httpTrigger",
      httpTriggerId: "trig-1",
      httpTriggerExecutionId: "exec-1",
    });
    expect(viewModel.processedUrlsHref).toBeNull();
    expect(viewModel.metadataHints).toEqual([]);
    expect(viewModel.requestSnapshotJson).toContain('"method": "POST"');
    expect(viewModel.requestSnapshotJson).toContain(SECRET_MASK);
    expect(viewModel.requestSnapshotJson).not.toContain("secret-token");
  });

  it("exposes masked run parameters when the run has any", () => {
    const summary = baseSummary();
    summary.execution.runParams = { itemId: "abc", apiKey: "secret-value" };

    const viewModel = buildExecutionDetailViewModel({
      parent: { kind: "httpTrigger", id: "trig-1", name: "Webhook" },
      executionId: "exec-1",
      summary,
    });

    expect(viewModel.runParamsJson).toContain('"itemId": "abc"');
    expect(viewModel.runParamsJson).toContain(SECRET_MASK);
    expect(viewModel.runParamsJson).not.toContain("secret-value");
  });

  it("omits run parameters when the run has none", () => {
    const summary = baseSummary();
    summary.execution.runParams = {};

    const viewModel = buildExecutionDetailViewModel({
      parent: { kind: "manual", id: "pipe-1", name: "Daily digest" },
      executionId: "exec-1",
      summary,
    });

    expect(viewModel.runParamsJson).toBeNull();
  });

  it("labels manual runs and surfaces their metadata hints", () => {
    const summary = baseSummary();
    summary.execution.runStatus = "pending";
    summary.execution.metadata = { source: "dashboard" };

    const viewModel = buildExecutionDetailViewModel({
      parent: { kind: "manual", id: "pipe-1", name: "Daily digest" },
      executionId: "exec-1",
      summary,
    });

    expect(viewModel.sourceLabel).toBe("Manual run");
    expect(viewModel.metadataHints).toEqual([
      "Started from: Dashboard (Run pipeline)",
    ]);
    expect(viewModel.pipeline).toBeNull();
    expect(viewModel.requestSnapshotJson).toBeNull();
    expect(viewModel.processedUrlsHref).toBeNull();
    expect(viewModel.canCancel).toBe(true);
    expect(viewModel.cancelTarget).toEqual({
      kind: "manual",
      pipelineId: "pipe-1",
      manualExecutionId: "exec-1",
    });
    expect(viewModel.payloadSource).toEqual({
      kind: "manual",
      parentId: "pipe-1",
      executionId: "exec-1",
    });
  });

  it("masks secrets in enqueue errors before they reach the view", () => {
    const summary = baseSummary();
    summary.execution.enqueueStatus = "failed";
    summary.execution.errors = { nested: { apiKey: "must-not-leak" } };

    const viewModel = buildExecutionDetailViewModel({
      parent: { kind: "schedule", id: "sched-1", name: "Morning run" },
      executionId: "exec-1",
      summary,
    });

    const serializedErrors = JSON.stringify(viewModel.enqueueErrors);

    expect(serializedErrors).toContain(SECRET_MASK);
    expect(serializedErrors).not.toContain("must-not-leak");
  });

  it("keeps a missing pipeline as null", () => {
    const summary = { ...baseSummary(), pipeline: null };

    const viewModel = buildExecutionDetailViewModel({
      parent: { kind: "schedule", id: "sched-1", name: "Morning run" },
      executionId: "exec-1",
      summary,
    });

    expect(viewModel.pipeline).toBeNull();
  });
});
