import React from "react";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ScheduleExecutionInvocationsTableProps } from "@/components/schedule-execution-invocations-table";
import type { ManualPipelineExecutionSummary } from "@/lib/pipeline-executions";

const getManualPipelineExecutionSummaryMock = vi.fn();
const notFoundMock = vi.fn();
const invocationsTablePropsMock = vi.fn();

vi.mock("next/navigation", () => ({
  notFound: () => notFoundMock(),
  useRouter: () => ({ refresh: vi.fn() }),
}));

vi.mock("@/lib/pipeline-executions", () => ({
  getManualPipelineExecutionSummary: (...args: unknown[]) =>
    getManualPipelineExecutionSummaryMock(...args),
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

import PipelineExecutionDetailPage from "./page";

const ROUTE_ENQUEUE_ERROR_MESSAGE = "MANUAL_PIPELINE_ROUTE_ENQUEUE_FAIL";

const minimalFailedSummary = (): ManualPipelineExecutionSummary => ({
  execution: {
    id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
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
  pipeline: { id: "pipe-1", name: "Test pipeline" },
  stepExecutions: [],
  invocations: [],
});

describe("PipelineExecutionDetailPage (manual execution)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    getManualPipelineExecutionSummaryMock.mockReset();
    notFoundMock.mockReset();
    invocationsTablePropsMock.mockReset();
  });

  it("renders enqueue diagnostics region with persisted errors for failed enqueue", async () => {
    getManualPipelineExecutionSummaryMock.mockResolvedValue(
      minimalFailedSummary(),
    );

    const ui = await PipelineExecutionDetailPage({
      params: Promise.resolve({
        id: "pipe-1",
        executionId: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
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
    expect(screen.getByText(/Dashboard HTTP/)).toBeInTheDocument();
  });

  it("passes scalar invocation rows and the manual payload scope to the table", async () => {
    // Setup
    getManualPipelineExecutionSummaryMock.mockResolvedValue({
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
    } satisfies ManualPipelineExecutionSummary);

    // Act
    const ui = await PipelineExecutionDetailPage({
      params: Promise.resolve({
        id: "pipe-1",
        executionId: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
      }),
    });
    render(ui as React.ReactElement);

    // Assert
    expect(getManualPipelineExecutionSummaryMock).toHaveBeenCalledWith(
      "pipe-1",
      "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
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
        kind: "manual",
        parentId: "pipe-1",
        executionId: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
      },
    });
  });
});
