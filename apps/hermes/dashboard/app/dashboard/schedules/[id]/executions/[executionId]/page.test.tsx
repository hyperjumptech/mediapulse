import React from "react";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ScheduleExecutionDetail } from "@/lib/schedules";

const getScheduleExecutionDetailMock = vi.fn();
const notFoundMock = vi.fn();

vi.mock("next/navigation", () => ({
  notFound: () => notFoundMock(),
}));

vi.mock("@/lib/schedules", () => ({
  getScheduleExecutionDetail: (...args: unknown[]) =>
    getScheduleExecutionDetailMock(...args),
}));

vi.mock("@/lib/mask-json-secrets", () => ({
  maskScheduleExecutionDetailForDisplay: (detail: unknown) => detail,
  maskSecretsInJson: (value: unknown) => value,
}));

vi.mock("@/lib/compute-execution-elapsed", () => ({
  computePipelineWallElapsed: vi
    .fn()
    .mockReturnValue({ kind: "unknown" as const }),
  formatPipelineElapsedLabel: vi.fn().mockReturnValue("—"),
}));

vi.mock("@/lib/format-invocation-error", () => ({
  formatInvocationErrorSummary: vi.fn().mockReturnValue(null),
}));

vi.mock("@/components/schedule-execution-invocations-table", () => ({
  ScheduleExecutionInvocationsTable: () => (
    <div data-testid="invocations-stub">Invocations</div>
  ),
}));

import ScheduleExecutionDetailPage from "./page";

const ROUTE_ENQUEUE_ERROR_MESSAGE = "SCHEDULE_ROUTE_ENQUEUE_FAIL";

const minimalFailedDetail = (): ScheduleExecutionDetail => ({
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
    getScheduleExecutionDetailMock.mockReset();
    notFoundMock.mockReset();
  });

  it("renders enqueue diagnostics region with persisted errors for failed enqueue", async () => {
    getScheduleExecutionDetailMock.mockResolvedValue(minimalFailedDetail());

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
});
