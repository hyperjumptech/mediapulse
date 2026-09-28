import React from "react";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ScheduleExecutionInvocationsTableProps } from "@/components/schedule-execution-invocations-table";
import type { ScheduleExecutionSummary } from "@/lib/schedules";

const getScheduleExecutionSummaryMock = vi.fn();
const notFoundMock = vi.fn();
const invocationsTablePropsMock = vi.fn();

vi.mock("next/navigation", () => ({
  notFound: () => notFoundMock(),
  useRouter: () => ({ refresh: vi.fn() }),
}));

vi.mock("@/lib/schedules", () => ({
  getScheduleExecutionSummary: (...args: unknown[]) =>
    getScheduleExecutionSummaryMock(...args),
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

import ScheduleExecutionDetailPage from "./page";

const ROUTE_ENQUEUE_ERROR_MESSAGE = "SCHEDULE_ROUTE_ENQUEUE_FAIL";

const minimalFailedSummary = (): ScheduleExecutionSummary => ({
  execution: {
    id: "exec-schedule-1",
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
  pipeline: null,
  schedule: { id: "sched-1", name: "Test schedule" },
  stepExecutions: [],
  invocations: [],
});

describe("ScheduleExecutionDetailPage", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    getScheduleExecutionSummaryMock.mockReset();
    notFoundMock.mockReset();
    invocationsTablePropsMock.mockReset();
  });

  it("renders enqueue diagnostics region with persisted errors for failed enqueue", async () => {
    getScheduleExecutionSummaryMock.mockResolvedValue(minimalFailedSummary());

    const ui = await ScheduleExecutionDetailPage({
      params: Promise.resolve({
        id: "sched-1",
        executionId: "exec-schedule-1",
      }),
    });
    render(ui as React.ReactElement);

    const region = await screen.findByRole("region", {
      name: /enqueue diagnostics/i,
    });
    expect(region).toBeInTheDocument();
    expect(
      await screen.findByText(ROUTE_ENQUEUE_ERROR_MESSAGE),
    ).toBeInTheDocument();
    expect(screen.getByText(/Enqueue status:/)).toBeInTheDocument();
    expect(screen.getByText("failed")).toBeInTheDocument();
    expect(screen.getByText(/Invocation transport:/)).toBeInTheDocument();
    expect(screen.getByText(/Hermes worker \+ DataQueue/)).toBeInTheDocument();
  });

  it("passes scalar invocation rows and the schedule payload scope to the table", async () => {
    // Setup
    getScheduleExecutionSummaryMock.mockResolvedValue({
      ...minimalFailedSummary(),
      invocations: [
        {
          jobId: "job-1",
          status: "failed",
          semanticStatus: "failure",
          agentId: "agent-a",
          outcomeSummary: "HTTP 502",
          enqueuedAt: new Date("2026-04-21T12:00:00.000Z"),
          startedAt: new Date("2026-04-21T12:00:01.000Z"),
          completedAt: null,
          dataQueueAttempts: 1,
          dataQueueMaxAttempts: 3,
        },
      ],
    } satisfies ScheduleExecutionSummary);

    // Act
    const ui = await ScheduleExecutionDetailPage({
      params: Promise.resolve({
        id: "sched-1",
        executionId: "exec-schedule-1",
      }),
    });
    render(ui as React.ReactElement);

    // Assert
    expect(getScheduleExecutionSummaryMock).toHaveBeenCalledWith(
      "sched-1",
      "exec-schedule-1",
    );
    expect(invocationsTablePropsMock).toHaveBeenCalledWith({
      invocations: [
        {
          jobId: "job-1",
          status: "failed",
          semanticStatus: "failure",
          outcomeSummary: "HTTP 502",
          agentId: "agent-a",
          startedAtIso: "2026-04-21T12:00:01.000Z",
          completedAtIso: null,
          dataQueueAttempts: 1,
          dataQueueMaxAttempts: 3,
        },
      ],
      payloadSource: {
        kind: "schedule",
        parentId: "sched-1",
        executionId: "exec-schedule-1",
      },
    });
  });
});
