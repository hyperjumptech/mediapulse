import React from "react";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ScheduleExecutionInvocationsTableProps } from "@/components/schedule-execution-invocations-table";
import type { HttpTriggerExecutionSummary } from "@/lib/http-triggers";

const getHttpTriggerExecutionSummaryMock = vi.fn();
const notFoundMock = vi.fn();
const invocationsTablePropsMock = vi.fn();

vi.mock("next/navigation", () => ({
  notFound: () => notFoundMock(),
  useRouter: () => ({ refresh: vi.fn() }),
}));

vi.mock("@/lib/http-triggers", () => ({
  getHttpTriggerExecutionSummary: (...args: unknown[]) =>
    getHttpTriggerExecutionSummaryMock(...args),
}));

vi.mock("@/lib/require-dashboard-admin", () => ({
  withDashboardAdmin: <Value,>(load: Promise<Value>) => load,
  requireDashboardAdmin: async () => ({
    id: "u1",
    name: "U",
    email: "u@example.com",
    credentialVersion: 0,
  }),
}));

vi.mock("@/lib/mask-json-secrets", () => ({
  maskExecutionSummaryForDisplay: (summary: unknown) => summary,
  maskSecretsInJson: (value: unknown) => value,
}));

vi.mock("@/lib/compute-execution-elapsed", () => ({
  computePipelineWallElapsed: vi
    .fn()
    .mockReturnValue({ kind: "unknown" as const }),
  formatPipelineElapsedLabel: vi.fn().mockReturnValue("—"),
}));

vi.mock("@/components/schedule-execution-invocations-table", () => ({
  ScheduleExecutionInvocationsTable: (
    props: ScheduleExecutionInvocationsTableProps,
  ) => {
    invocationsTablePropsMock(props);

    return <div data-testid="invocations-stub">Invocations</div>;
  },
}));

import HttpTriggerExecutionDetailPage from "./page";

const ROUTE_ENQUEUE_ERROR_MESSAGE = "HTTP_TRIGGER_ROUTE_ENQUEUE_FAIL";

const minimalFailedSummary = (): HttpTriggerExecutionSummary => ({
  execution: {
    id: "exec-http-1",
    executionTime: new Date("2026-04-21T12:00:00.000Z"),
    enqueueStatus: "failed",
    runStatus: "pending",
    effectiveExecutionConfig: null,
    jobsCreated: 0,
    jobsEnqueued: 0,
    succeededInvocationCount: 0,
    failedInvocationCount: 0,
    errors: [
      {
        message: ROUTE_ENQUEUE_ERROR_MESSAGE,
        timestamp: "2026-04-21T12:00:01.000Z",
      },
    ],
    metadata: null,
    createdAt: new Date("2026-04-21T12:00:00.000Z"),
  },
  pipeline: { id: "pipe-1", name: "P" },
  trigger: { id: "trig-1", name: "Test trigger" },
  stepExecutions: [],
  invocations: [],
});

describe("HttpTriggerExecutionDetailPage", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    getHttpTriggerExecutionSummaryMock.mockReset();
    notFoundMock.mockReset();
    invocationsTablePropsMock.mockReset();
  });

  it("renders enqueue diagnostics region with persisted errors for failed enqueue", async () => {
    getHttpTriggerExecutionSummaryMock.mockResolvedValue(
      minimalFailedSummary(),
    );

    const ui = await HttpTriggerExecutionDetailPage({
      params: Promise.resolve({
        id: "trig-1",
        executionId: "exec-http-1",
      }),
    });
    render(ui as React.ReactElement);

    expect(
      await screen.findByRole("region", { name: /enqueue diagnostics/i }),
    ).toBeInTheDocument();
    expect(
      await screen.findByText(ROUTE_ENQUEUE_ERROR_MESSAGE),
    ).toBeInTheDocument();
    expect(screen.getByText(/Enqueue status:/)).toBeInTheDocument();
    expect(screen.getByText("failed")).toBeInTheDocument();
    expect(screen.getByText(/Invocation transport:/)).toBeInTheDocument();
    expect(screen.getByText(/Hermes worker \+ DataQueue/)).toBeInTheDocument();
  });

  it("passes scalar invocation rows and the httpTrigger payload scope to the table", async () => {
    // Setup
    getHttpTriggerExecutionSummaryMock.mockResolvedValue({
      ...minimalFailedSummary(),
      invocations: [
        {
          jobId: "job-1",
          status: "completed",
          semanticStatus: "success",
          agentId: "agent-a",
          outcomeSummary: null,
          enqueuedAt: new Date("2026-04-21T12:00:00.000Z"),
          startedAt: new Date("2026-04-21T12:00:01.000Z"),
          completedAt: new Date("2026-04-21T12:00:04.000Z"),
          dataQueueAttempts: null,
          dataQueueMaxAttempts: null,
        },
      ],
    } satisfies HttpTriggerExecutionSummary);

    // Act
    const ui = await HttpTriggerExecutionDetailPage({
      params: Promise.resolve({
        id: "trig-1",
        executionId: "exec-http-1",
      }),
    });
    render(ui as React.ReactElement);

    // Assert
    expect(getHttpTriggerExecutionSummaryMock).toHaveBeenCalledWith(
      "trig-1",
      "exec-http-1",
    );
    expect(invocationsTablePropsMock).toHaveBeenCalledWith({
      invocations: [
        {
          jobId: "job-1",
          status: "completed",
          semanticStatus: "success",
          outcomeSummary: null,
          agentId: "agent-a",
          startedAtIso: "2026-04-21T12:00:01.000Z",
          completedAtIso: "2026-04-21T12:00:04.000Z",
          dataQueueAttempts: null,
          dataQueueMaxAttempts: null,
        },
      ],
      payloadSource: {
        kind: "httpTrigger",
        parentId: "trig-1",
        executionId: "exec-http-1",
      },
    });
  });
});
